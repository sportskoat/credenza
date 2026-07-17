import { useState, useEffect, useRef, useMemo } from "react";

// ————— Credenza v3 —————
// Capture instantly. Enrich eventually. Review beautifully. Remember why I saved it.
// A walnut credenza full of cream index cards. One file, no backend — but the code is
// organized (storage adapter, AI adapter, scoring utilities) so a server, iOS Shortcut,
// or database could be swapped in later without touching the UI.

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ CONSTANTS & THEME ═══
// ═══════════════════════════════════════════════════════════════════════════════════

const WALNUT = "#261E17";
const PANEL = "#1D1712";
const PANEL_LT = "#322820";
const CREAM = "#F0E6D2";
const CREAM_DIM = "#B7A98E";
const MUSTARD = "#D9A441";
const LINE = "#3E3226";
const CARD_RULE = "#C46A5A"; // index-card red rule

const TYPES = {
  video: { label: "VIDEO", color: "#C4652F" },
  tweet: { label: "POST", color: "#6E8CA0" },
  audio: { label: "AUDIO", color: "#8A8B5C" },
  article: { label: "READ", color: "#D9A441" },
  note: { label: "NOTE", color: "#A8988A" },
};

const FILTERS = ["all", "video", "tweet", "article", "audio", "note"];
const FUTURA = "Futura, 'Century Gothic', 'Trebuchet MS', sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const DAY_MS = 864e5;
const WEEK_MS = 7 * DAY_MS;
const RESURFACE_MIN_AGE_MS = 14 * DAY_MS;
const DISMISS_COOLDOWN_MS = 7 * DAY_MS;
const GEM_MIN_AGE_MS = 30 * DAY_MS;
const DUPE_BANNER_MS = 3500;

// Tracking params stripped before comparing article URLs.
const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "gclsrc", "dclid", "msclkid", "mc_eid", "mc_cid",
  "igshid", "igsh", "si", "ref", "ref_src", "ref_url", "s", "t", "feature",
  "ck_subscriber_id", "_hsenc", "_hsmi", "vero_id", "twclid", "ttclid",
]);

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ PARSING & CANONICALIZATION ═══
// ═══════════════════════════════════════════════════════════════════════════════════

function getYouTubeId(url) {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/
  );
  return m ? m[1] : null;
}

// classify(raw) → { type, url, host, videoId } consistently.
function classify(raw) {
  const text = (raw || "").trim();
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
  if (/(^|\.)(twitter\.com|x\.com)$/.test(host)) return { type: "tweet", url, host, videoId: null };
  if (/(^|\.)(youtube\.com|youtu\.be|tiktok\.com|vimeo\.com)$/.test(host))
    return { type: "video", url, host, videoId: null };
  if (/(^|\.)(spotify\.com|soundcloud\.com|music\.apple\.com)$/.test(host))
    return { type: "audio", url, host, videoId: null };
  return { type: "article", url, host, videoId: null };
}

function collapseWhitespace(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

// Host + path with tracking params stripped, trailing slash trimmed, lowercased.
function normalizedHostPath(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    const kept = [];
    u.searchParams.forEach((val, key) => {
      const lk = key.toLowerCase();
      if (TRACKING_PARAMS.has(lk) || lk.startsWith("utm_")) return;
      kept.push(`${lk}=${val}`);
    });
    kept.sort();
    const query = kept.length ? "?" + kept.join("&") : "";
    return (host + path + query).toLowerCase();
  } catch (e) {
    return (url || "").toLowerCase();
  }
}

// canonicalKey(parsed, rawText) — stable identity for duplicate detection.
function canonicalKey(parsed, rawText) {
  const { type, url, videoId } = parsed;
  if (!url) {
    // Notes: exact-match only (no fuzzy). First 80 chars of collapsed lowercased text.
    return "note:" + collapseWhitespace(rawText).toLowerCase().slice(0, 80);
  }
  let host = "";
  let pathname = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    pathname = u.pathname;
  } catch (e) {
    return "article:" + normalizedHostPath(url);
  }

  // YouTube → youtube:<videoId>
  const yt = videoId || getYouTubeId(url);
  if (yt) return "youtube:" + yt;

  // X / Twitter → status id if present, else normalized path
  if (/(^|\.)(twitter\.com|x\.com)$/.test(host)) {
    const m = pathname.match(/\/[^/]+\/status\/(\d+)/);
    if (m) return "x:" + m[1];
    return "x:" + normalizedHostPath(url);
  }

  // TikTok → /video/<id> or /t/<code>, else normalized path
  if (/(^|\.)tiktok\.com$/.test(host)) {
    const mv = pathname.match(/\/video\/(\d+)/);
    if (mv) return "tiktok:" + mv[1];
    const mt = pathname.match(/\/t\/([\w-]+)/);
    if (mt) return "tiktok:" + mt[1];
    return "tiktok:" + normalizedHostPath(url);
  }

  // Spotify → spotify:<pathType>/<id>, else normalized path
  if (/(^|\.)spotify\.com$/.test(host)) {
    const ms = pathname.match(/\/(track|episode|show|album|playlist|artist)\/([\w]+)/);
    if (ms) return "spotify:" + ms[1] + "/" + ms[2];
    return "spotify:" + normalizedHostPath(url);
  }

  // Everything else keys on host+path with tracking params removed.
  return "article:" + normalizedHostPath(url);
}

// ————— Item factory & migration —————
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Defaults for every field a v3 item must carry.
function itemDefaults() {
  return {
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rawText: "",
    url: null,
    canonicalKey: "",
    type: "note",
    host: null,
    videoId: null,
    title: "",
    summary: "",
    tags: [],
    status: "raw",
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
    error: null,
  };
}

// createItem(parsed, rawText) → fresh raw item ready to persist immediately.
function createItem(parsed, rawText) {
  const now = Date.now();
  const isNote = parsed.type === "note";
  return {
    ...itemDefaults(),
    id: makeId(),
    createdAt: now,
    updatedAt: now,
    rawText,
    url: parsed.url || null,
    canonicalKey: canonicalKey(parsed, rawText),
    type: parsed.type,
    host: parsed.host || null,
    videoId: parsed.videoId || null,
    title: parsed.url ? parsed.url : rawText.slice(0, 80),
    summary: isNote ? rawText : "",
    tags: [],
    status: "raw",
  };
}

// migrateItem(old) — upgrade v2 items on load; idempotent for already-v3 items.
function migrateItem(old) {
  if (!old || typeof old !== "object") return null;

  // Already a v3 item: just backfill any missing fields.
  if (old.status && old.createdAt && old.canonicalKey) {
    return { ...itemDefaults(), ...old, id: old.id || makeId() };
  }

  const createdAt = old.createdAt || old.ts || Date.now();
  const rawText =
    old.rawText != null ? old.rawText : old.text != null ? old.text : old.title || "";
  const parsed = {
    type: old.type || "note",
    url: old.url || null,
    host: old.host || null,
    videoId: old.videoId || null,
  };
  // v2 stale "pending" item → "failed" so it gets a Retry. Otherwise "ready".
  const status = old.pending ? "failed" : "ready";
  return {
    ...itemDefaults(),
    id: old.id || makeId(),
    createdAt,
    updatedAt: old.updatedAt || createdAt,
    rawText,
    url: old.url || null,
    canonicalKey: old.canonicalKey || canonicalKey(parsed, rawText),
    type: old.type || "note",
    host: old.host || null,
    videoId: old.videoId || null,
    title: old.title || (old.url ? old.url : String(rawText).slice(0, 80)),
    summary: old.summary || "",
    tags: Array.isArray(old.tags) ? old.tags.map(String) : [],
    status,
    note: old.note || "",
    error: status === "failed" ? "Never finished filing (migrated from an old save)." : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ STORAGE ADAPTER ═══
// ═══════════════════════════════════════════════════════════════════════════════════

const KEY_V3 = "credenza-items-v3";
const KEY_V2 = "credenza-items-v1";

// window.storage (artifact host) if present, else localStorage, each guarded.
const storageBackend = {
  async get(key) {
    if (typeof window !== "undefined" && typeof window.storage?.get === "function") {
      try {
        const r = await window.storage.get(key);
        return r ? r.value : null;
      } catch (e) {
        return null;
      }
    }
    try {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    } catch (e) {
      // iOS Safari private mode throws on access.
      return null;
    }
  },
  async set(key, value) {
    if (typeof window !== "undefined" && typeof window.storage?.set === "function") {
      try {
        await window.storage.set(key, value);
        return;
      } catch (e) {
        return;
      }
    }
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    } catch (e) {
      // ignore quota / private-mode errors
    }
  },
};

// loadItems() → migrated item array, [] on any error. Migrates v2 data on first load.
async function loadItems() {
  try {
    let raw = await storageBackend.get(KEY_V3);
    let fromV2 = false;
    let parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
      const v2raw = await storageBackend.get(KEY_V2);
      if (v2raw) {
        parsed = JSON.parse(v2raw);
        fromV2 = true;
      }
    }
    if (!Array.isArray(parsed)) return [];
    const migrated = parsed.map(migrateItem).filter(Boolean);
    if (fromV2) {
      // Persist the migrated set under the v3 key so we only migrate once.
      await saveItems(migrated);
    }
    return migrated;
  } catch (e) {
    return [];
  }
}

async function saveItems(items) {
  try {
    await storageBackend.set(KEY_V3, JSON.stringify(items));
  } catch (e) {
    console.error("save failed", e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ AI ADAPTER ═══
// ═══════════════════════════════════════════════════════════════════════════════════
// All Claude calls live here; components never fetch directly. Runs inside a Claude
// Artifact where this fetch to api.anthropic.com is proxied.

async function callClaude(prompt, { useSearch = false, maxTokens = 1000 } = {}) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

  // Abort hung requests: a call that never settles would strand items in "enriching",
  // where there is no RETRY affordance.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error("Network error reaching the assistant.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error("Assistant returned HTTP " + res.status);
  }
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error("Assistant returned an unreadable response.");
  }
  if (data && data.error) {
    throw new Error(data.error.message || "Assistant error.");
  }
  if (!data || !Array.isArray(data.content)) {
    throw new Error("Assistant returned no content.");
  }
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
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

const ENRICH_SCHEMA =
  'Respond with ONLY minified JSON, no markdown, exactly this shape: {"title":"short title","summary":"one crisp sentence","tags":["tag1","tag2","tag3"]}';

// enrichItem(item) → { title, summary, tags }. Throws on hard failure (no answer) so the
// caller can mark status "failed" with error. Keeps v2's three prompt variants verbatim.
async function enrichItem(item) {
  let prompt;
  let useSearch = false;
  if (item.type === "note") {
    prompt = `Here is a personal note someone saved for later:\n"""${item.rawText}"""\nGive it a short title, a one-sentence summary, and 3 lowercase topic tags. ${ENRICH_SCHEMA}`;
  } else if (item.type === "tweet") {
    useSearch = true;
    prompt = `Look up this X/Twitter post: ${item.url}\nWrite it the way a person would RECALL this tweet later, not like a news abstract. The title should be a short punchy recall hook leading with the most vivid, weird, or memorable detail ("the girl up 25 days on an adderall binge", "guy who sold his house for bitcoin at the top"). The summary is one sentence with the real substance and meaning intact, naming who posted it. Include the poster's handle as one of the tags. ${ENRICH_SCHEMA}`;
  } else {
    useSearch = true;
    prompt = `Look up this link and figure out what it is: ${item.url}\nIf it is a video, say what the video covers and who made it. The summary should say why it is worth coming back to. ${ENRICH_SCHEMA}`;
  }
  const text = await callClaude(prompt, { useSearch });
  const parsed = safeParseJson(text);
  if (!parsed) {
    // Got a response but couldn't parse it — treat as a soft result, not a hard failure.
    return { title: item.title, summary: "Saved. Couldn't fetch details.", tags: [] };
  }
  return {
    title: parsed.title || item.title,
    summary: parsed.summary || "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4).map(String) : [],
  };
}

// heuristicIntent(note) — deterministic fallback when the AI extraction call fails.
function heuristicIntent(note) {
  const text = (note || "").trim();
  const out = { extractedIntent: "", project: "", people: [], useCase: "", importance: "medium" };
  if (!text) return out;

  // importance
  if (/\b(important|critical|must|need to|deadline|asap|!!)\b/i.test(text)) out.importance = "high";
  else if (/\b(someday|maybe|eventually|idle|casual)\b/i.test(text)) out.importance = "low";

  // project
  const projMatch =
    text.match(/\bfor (?:the )?([\w\s-]{2,30}?)(?:project|app|site|talk|post)\b/i) ||
    text.match(/\bproject:\s*([\w\s-]{2,30})/i);
  if (projMatch) out.project = projMatch[1].trim();

  // people: @handles + capitalized runs not sentence-initial common words.
  const handles = (text.match(/@[\w]+/g) || []).map((h) => h);
  const commonInitial = new Set(["The", "This", "That", "These", "Those", "It", "A", "An", "I", "We", "They", "He", "She"]);
  const people = [];
  const capRe = /(?:^|[.!?]\s+|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
  let m;
  let firstWord = true;
  while ((m = capRe.exec(text)) !== null) {
    let cand = m[1];
    const startsSentence = firstWord || /[.!?]\s+$/.test(text.slice(0, m.index + m[0].length - cand.length));
    firstWord = false;
    if (startsSentence) {
      // Sentence-initial capitals are usually imperative verbs ("Watch", "Ask"), not names.
      cand = cand.split(" ").slice(1).join(" ");
      if (!cand) continue;
    }
    if (commonInitial.has(cand)) continue;
    if (!people.includes(cand)) people.push(cand);
  }
  out.people = [...handles, ...people].slice(0, 3);

  // useCase: first purpose clause.
  const useMatch = text.match(/\b(to|so I can|when I)\s+([^.,;]{3,60})/i);
  if (useMatch) out.useCase = (useMatch[1] + " " + useMatch[2]).trim();

  // extractedIntent: first sentence, trimmed ~100 chars.
  const firstSentence = (text.split(/(?<=[.!?])\s+/)[0] || text).trim();
  out.extractedIntent = firstSentence.slice(0, 100);

  return out;
}

// extractCardBackIntent(item, note) → intent fields. One AI call, heuristic fallback.
async function extractCardBackIntent(item, note) {
  const clean = (note || "").trim();
  if (!clean) return heuristicIntent("");
  try {
    const prompt = `Someone wrote this on the back of a saved card:\n"""${clean}"""\nExtract what they intend to do with the saved thing. Respond with ONLY minified JSON, exactly this shape: {"extractedIntent":"one short phrase of what they want out of this","project":"a project/effort name if mentioned else empty","people":["names or @handles mentioned"],"useCase":"the concrete use if stated else empty","importance":"low|medium|high"}`;
    const text = await callClaude(prompt, { useSearch: false, maxTokens: 400 });
    const parsed = safeParseJson(text);
    if (!parsed) return heuristicIntent(clean);
    return {
      extractedIntent: typeof parsed.extractedIntent === "string" ? parsed.extractedIntent : "",
      project: typeof parsed.project === "string" ? parsed.project : "",
      people: Array.isArray(parsed.people) ? parsed.people.map(String).slice(0, 3) : [],
      useCase: typeof parsed.useCase === "string" ? parsed.useCase : "",
      importance: ["low", "medium", "high"].includes(parsed.importance) ? parsed.importance : "medium",
    };
  } catch (e) {
    return heuristicIntent(clean);
  }
}

// askVault(question, candidates) → plain-text answer over a bounded candidate set.
async function askVault(question, candidates) {
  const compact = candidates.map((x) => ({
    title: x.title,
    summary: x.summary,
    tags: x.tags,
    host: x.host,
    note: x.note || "",
    extractedIntent: x.extractedIntent || "",
    project: x.project || "",
    people: x.people || [],
    useCase: x.useCase || "",
    type: x.type,
    date: new Date(x.createdAt).toISOString().slice(0, 10),
  }));
  return callClaude(
    `Here are the most relevant items from my personal saved-links vault as JSON:\n${JSON.stringify(
      compact
    )}\n\nQuestion: ${question}\n\nAnswer briefly and conversationally in plain text (no markdown), referencing item titles where relevant. The "note", "extractedIntent", "project", and "useCase" fields are what I wrote or meant to do with each — weigh them heavily. If nothing matches, say so.`,
    { useSearch: false }
  );
}

// generateDigestCopy(...) → { intro, reasons:{id:reason}, gemReason }. AI writes only the
// WORDS; selection already happened via scoring. Falls back to note/summary + stock intro.
async function generateDigestCopy(scoredPicks, gem, weekCount) {
  const fallback = () => {
    const reasons = {};
    scoredPicks.forEach((it) => {
      reasons[it.id] = it.note || it.summary || "Worth a second look.";
    });
    return {
      intro: "Here's what deserves a second look this week.",
      reasons,
      gemReason: gem ? gem.note || gem.summary || "Been sitting a while — still good." : "",
    };
  };
  if (scoredPicks.length === 0 && !gem) return fallback();
  try {
    const payload = {
      weekCount,
      picks: scoredPicks.map((x) => ({
        id: x.id,
        title: x.title,
        summary: x.summary,
        note: x.note || "",
        tags: x.tags,
      })),
      gem: gem
        ? { id: gem.id, title: gem.title, summary: gem.summary, note: gem.note || "" }
        : null,
    };
    const text = await callClaude(
      `Here are picks already selected for my weekly digest as JSON:\n${JSON.stringify(
        payload
      )}\n\nWrite the copy only — do NOT reselect. For each pick write one short punchy line on why it's worth my time, in a warm, dry, slightly literary voice. Also write a one-sentence intro capturing the week's theme, and if a gem is present a one-line reason it's worth resurfacing.\nRespond ONLY with minified JSON: {"intro":"...","reasons":{"<id>":"reason", ...}${gem ? ',"gemReason":"..."' : ""}}`,
      { useSearch: false }
    );
    const parsed = safeParseJson(text);
    if (!parsed) return fallback();
    const reasons = {};
    scoredPicks.forEach((it) => {
      const r = parsed.reasons && parsed.reasons[it.id];
      reasons[it.id] = r || it.note || it.summary || "Worth a second look.";
    });
    return {
      intro: parsed.intro || "Here's what deserves a second look this week.",
      reasons,
      gemReason:
        (parsed.gemReason && String(parsed.gemReason)) ||
        (gem ? gem.note || gem.summary || "" : ""),
    };
  } catch (e) {
    return fallback();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ SCORING UTILITIES ═══
// ═══════════════════════════════════════════════════════════════════════════════════

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "her", "was",
  "one", "our", "out", "day", "get", "has", "him", "his", "how", "man", "new", "now",
  "old", "see", "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she",
  "too", "use", "that", "this", "with", "have", "from", "they", "what", "your", "when",
  "were", "there", "their", "would", "about", "which", "them", "then", "some", "into",
]);

function tokenizeQuery(q) {
  return (q || "")
    .toLowerCase()
    .split(/[^a-z0-9@]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

// Weighted token scoring for ASK candidate selection.
function scoreAskCandidate(item, tokens) {
  const fields = [
    { text: item.note || "", w: 4 },
    { text: item.extractedIntent || "", w: 3 },
    { text: item.project || "", w: 3 },
    { text: item.useCase || "", w: 3 },
    { text: (item.people || []).join(" "), w: 3 },
    { text: item.title || "", w: 2 },
    { text: (item.tags || []).join(" "), w: 2 },
    { text: item.summary || "", w: 1 },
    { text: item.host || "", w: 1 },
  ];
  let score = 0;
  for (const f of fields) {
    const hay = f.text.toLowerCase();
    if (!hay) continue;
    for (const tok of tokens) {
      if (hay.includes(tok)) score += f.w;
    }
  }
  return score;
}

function selectAskCandidates(items, query) {
  const ready = items.filter((x) => x.status === "ready");
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return [...ready].sort((a, b) => b.createdAt - a.createdAt).slice(0, 40);
  }
  const scored = ready
    .map((x) => ({ item: x, score: scoreAskCandidate(x, tokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) {
    return [...ready].sort((a, b) => b.createdAt - a.createdAt).slice(0, 40);
  }
  return scored.slice(0, 25).map((s) => s.item);
}

// Digest candidate score (pure). Includes ready + failed items (still saved), not raw/enriching.
function scoreDigestCandidate(item, now) {
  let s = 0;
  const age = now - item.createdAt;
  if (age < WEEK_MS) s += 3;
  else if (age < 14 * DAY_MS) s += 1;
  if (item.note && item.note.trim()) s += 3;
  if (item.importance === "high") s += 2;
  else if (item.importance === "low") s -= 1;
  if ((item.project && item.project.trim()) || (item.useCase && item.useCase.trim())) s += 1;
  if (item.lastOpenedAt == null) s += 2;
  s -= Math.min(4, 1.5 * (item.digestCount || 0));
  s += (Math.random() - 0.5); // ±0.5 tiebreaker
  return s;
}

function scoreForgottenGem(item, now) {
  let s = 0;
  if (item.note && item.note.trim()) s += 3;
  if (item.importance === "high") s += 2;
  if (item.lastOpenedAt == null) s += 2;
  s -= Math.min(4, 1.5 * (item.digestCount || 0));
  s += (Math.random() - 0.5);
  return s;
}

// Resurface candidate score. Eligible: >14d old, not dismissed <7d ago, status ready/failed.
function scoreResurfaceCandidate(item, now) {
  let s = 0;
  if (item.note && item.note.trim()) s += 3;
  if (item.importance === "high") s += 2;
  if (item.lastOpenedAt == null) s += 2;
  if (
    (item.project && item.project.trim()) ||
    (item.useCase && item.useCase.trim()) ||
    (item.people && item.people.length)
  )
    s += 1;
  s -= Math.min(4, 1.5 * (item.resurfacedCount || 0));
  if (now - item.createdAt > GEM_MIN_AGE_MS) s += 1;
  s += (Math.random() - 0.5);
  return s;
}

function isResurfaceEligible(item, now) {
  // Failed items already surface in the Inbox with RETRY; resurfacing is for the shelf.
  if (item.status !== "ready") return false;
  if (now - item.createdAt <= RESURFACE_MIN_AGE_MS) return false;
  if (item.dismissedAt && now - item.dismissedAt < DISMISS_COOLDOWN_MS) return false;
  return true;
}

function pickResurface(items, now) {
  const eligible = items.filter((x) => isResurfaceEligible(x, now));
  if (eligible.length === 0) return null;
  let best = null;
  let bestScore = -Infinity;
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
// ═══ COMPONENTS ═══
// ═══════════════════════════════════════════════════════════════════════════════════

function TypeChip({ active, name, onClick }) {
  const meta = TYPES[name];
  const color = meta ? meta.color : MUSTARD;
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FUTURA,
        fontSize: 11,
        letterSpacing: "0.14em",
        padding: "7px 13px",
        borderRadius: 3,
        border: `1px solid ${active ? color : LINE}`,
        background: active ? color : "transparent",
        color: active ? WALNUT : CREAM_DIM,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all .15s",
      }}
    >
      {name === "all" ? "ALL" : meta.label}
    </button>
  );
}

function Tag({ text }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 10.5,
        color: CREAM_DIM,
        border: `1px solid ${LINE}`,
        borderRadius: 3,
        padding: "3px 7px",
      }}
    >
      {text}
    </span>
  );
}

function SmallBtn({ children, onClick, fill, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: FUTURA,
        fontSize: 11,
        letterSpacing: "0.12em",
        fontWeight: 700,
        color: fill ? WALNUT : CREAM_DIM,
        background: fill ? color || MUSTARD : "transparent",
        border: fill ? "none" : `1px solid ${LINE}`,
        borderRadius: 3,
        padding: "8px 14px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ————— Inbox strip (raw / enriching / failed) —————
function InboxStrip({ items, onRetry }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontFamily: FUTURA,
          fontSize: 10,
          letterSpacing: "0.18em",
          fontWeight: 700,
          color: MUSTARD,
          marginBottom: 7,
        }}
      >
        INBOX · {items.length}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item) => {
          const meta = TYPES[item.type] || TYPES.note;
          const failed = item.status === "failed";
          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                background: PANEL,
                border: `1px solid ${failed ? CARD_RULE : LINE}`,
                borderRadius: 5,
                overflow: "hidden",
              }}
            >
              <div style={{ width: 5, alignSelf: "stretch", flexShrink: 0, background: meta.color }} />
              <div style={{ flex: 1, minWidth: 0, padding: "9px 12px" }}>
                <div
                  style={{
                    fontFamily: FUTURA,
                    fontSize: 13,
                    fontWeight: 600,
                    color: CREAM,
                    lineHeight: 1.3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.title || item.rawText}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 10.5,
                    color: failed ? CARD_RULE : CREAM_DIM,
                    marginTop: 3,
                  }}
                >
                  {failed
                    ? "couldn't file — " + (item.error || "try again")
                    : item.status === "enriching"
                    ? "filing…"
                    : "queued…"}
                </div>
              </div>
              {failed && (
                <button
                  onClick={() => onRetry(item.id)}
                  style={{
                    fontFamily: FUTURA,
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    fontWeight: 700,
                    color: WALNUT,
                    background: MUSTARD,
                    border: "none",
                    borderRadius: 3,
                    padding: "8px 14px",
                    margin: "0 10px",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  RETRY
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ————— Inline edit panel —————
function EditPanel({ item, onSave, onCancel }) {
  const [title, setTitle] = useState(item.title || "");
  const [summary, setSummary] = useState(item.summary || "");
  const [tags, setTags] = useState((item.tags || []).join(", "));
  const [project, setProject] = useState(item.project || "");
  const [importance, setImportance] = useState(item.importance || "medium");

  const field = {
    width: "100%",
    background: PANEL,
    border: `1px solid ${LINE}`,
    borderRadius: 4,
    outline: "none",
    color: CREAM,
    fontSize: 13.5,
    padding: "8px 10px",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };
  const label = {
    fontFamily: FUTURA,
    fontSize: 10,
    letterSpacing: "0.14em",
    fontWeight: 700,
    color: CREAM_DIM,
    marginBottom: 4,
    marginTop: 10,
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: 10,
        background: PANEL_LT,
        border: `1px solid ${LINE}`,
        borderRadius: 6,
        padding: "12px 14px",
      }}
    >
      <div style={{ ...label, marginTop: 0 }}>TITLE</div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={field} />

      <div style={label}>SUMMARY</div>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={2}
        style={{ ...field, resize: "none", lineHeight: 1.5 }}
      />

      <div style={label}>TAGS (comma-separated)</div>
      <input value={tags} onChange={(e) => setTags(e.target.value)} style={field} />

      <div style={label}>PROJECT</div>
      <input value={project} onChange={(e) => setProject(e.target.value)} style={field} />

      <div style={label}>IMPORTANCE</div>
      <div style={{ display: "flex", gap: 6 }}>
        {["low", "medium", "high"].map((lv) => (
          <button
            key={lv}
            onClick={() => setImportance(lv)}
            style={{
              fontFamily: FUTURA,
              fontSize: 10.5,
              letterSpacing: "0.12em",
              fontWeight: 700,
              padding: "7px 12px",
              borderRadius: 3,
              border: `1px solid ${importance === lv ? MUSTARD : LINE}`,
              background: importance === lv ? MUSTARD : "transparent",
              color: importance === lv ? WALNUT : CREAM_DIM,
              cursor: "pointer",
              flex: 1,
            }}
          >
            {lv === "low" ? "LOW" : lv === "medium" ? "MED" : "HIGH"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <SmallBtn
          fill
          onClick={() =>
            onSave({
              title: title.trim() || item.title,
              summary: summary.trim(),
              tags: tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
              project: project.trim(),
              importance,
            })
          }
        >
          SAVE
        </SmallBtn>
        <SmallBtn onClick={onCancel}>CANCEL</SmallBtn>
      </div>
    </div>
  );
}

// ————— Flip card —————
function Card({ item, expanded, onToggle, onDelete, onSaveNote, onEdit, onOpen, highlight }) {
  const meta = TYPES[item.type] || TYPES.note;
  const [imgOk, setImgOk] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.note || "");

  // Keep the card-back draft synced when the item's note changes underneath us.
  useEffect(() => {
    setDraft(item.note || "");
  }, [item.note]);

  useEffect(() => {
    if (!expanded) {
      setFlipped(false);
      setEditing(false);
    }
  }, [expanded]);

  const front = (
    <div style={{ flex: 1, minWidth: 0, padding: "12px 14px 12px 12px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
        <span
          style={{
            fontFamily: FUTURA,
            fontSize: 10,
            letterSpacing: "0.16em",
            color: meta.color,
            fontWeight: 700,
          }}
        >
          {meta.label}
        </span>
        {item.host && (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: CREAM_DIM,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.host}
          </span>
        )}
        {item.note && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: MUSTARD, flexShrink: 0 }}>
            ✎
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontFamily: MONO,
            fontSize: 10,
            color: CREAM_DIM,
            flexShrink: 0,
          }}
        >
          {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      </div>

      {item.videoId && imgOk && (
        <img
          src={`https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`}
          alt=""
          onError={() => setImgOk(false)}
          style={{
            width: "100%",
            aspectRatio: "16/9",
            objectFit: "cover",
            borderRadius: 4,
            marginBottom: 8,
            display: "block",
          }}
        />
      )}

      <div
        style={{
          fontFamily: FUTURA,
          fontSize: 15,
          fontWeight: 600,
          color: CREAM,
          lineHeight: 1.35,
          marginBottom: item.summary ? 4 : 0,
        }}
      >
        {item.title}
      </div>

      {item.summary && (
        <div
          style={{
            fontSize: 13,
            color: CREAM_DIM,
            lineHeight: 1.5,
            display: expanded ? "block" : "-webkit-box",
            WebkitLineClamp: expanded ? "unset" : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.summary}
        </div>
      )}

      {expanded && !editing && (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10 }}>
          {item.tags && item.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {item.tags.map((t, i) => (
                <Tag key={i} text={t} />
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => onOpen(item.id)}
                style={{
                  fontFamily: FUTURA,
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  fontWeight: 700,
                  color: WALNUT,
                  background: meta.color,
                  borderRadius: 3,
                  padding: "8px 14px",
                  textDecoration: "none",
                }}
              >
                OPEN
              </a>
            )}
            <SmallBtn onClick={() => setFlipped(true)}>FLIP ↻</SmallBtn>
            <SmallBtn onClick={() => setEditing(true)}>EDIT</SmallBtn>
            <SmallBtn onClick={() => onDelete(item.id)}>REMOVE</SmallBtn>
          </div>
        </div>
      )}

      {expanded && editing && (
        <EditPanel
          item={item}
          onSave={(patch) => {
            onEdit(item.id, patch);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );

  const backHint = item.project || item.extractedIntent;
  const back = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ flex: 1, minWidth: 0, padding: "12px 14px", transform: "rotateY(180deg)" }}
    >
      <div
        style={{
          fontFamily: FUTURA,
          fontSize: 10,
          letterSpacing: "0.16em",
          fontWeight: 700,
          color: meta.color,
          marginBottom: 8,
        }}
      >
        BACK OF THE CARD
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Why'd you keep this? What's it for?"
        rows={3}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${LINE}`,
          outline: "none",
          resize: "none",
          color: CREAM,
          fontSize: 13.5,
          lineHeight: 1.6,
          fontFamily: "inherit",
          padding: "2px 0 8px",
          boxSizing: "border-box",
        }}
      />
      {backHint && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: CREAM_DIM, marginTop: 8 }}>
          {item.project ? "project · " + item.project : "intent · " + item.extractedIntent}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <SmallBtn
          fill
          color={meta.color}
          onClick={() => {
            onSaveNote(item.id, draft.trim());
            setFlipped(false);
          }}
        >
          SAVE
        </SmallBtn>
        <SmallBtn onClick={() => setFlipped(false)}>FLIP BACK</SmallBtn>
      </div>
    </div>
  );

  return (
    <div style={{ perspective: 1200 }}>
      <div
        onClick={() => !flipped && onToggle()}
        style={{
          display: "flex",
          background: PANEL,
          borderRadius: 6,
          overflow: "hidden",
          border: `1px solid ${highlight ? MUSTARD : expanded ? meta.color : LINE}`,
          cursor: flipped ? "default" : "pointer",
          transition: "transform .5s, border-color .15s",
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <div style={{ width: 6, flexShrink: 0, background: meta.color }} />
        {flipped ? back : front}
      </div>
    </div>
  );
}

// ————— Digest deck (cream index cards) —————
function DigestDeck({ slides, onClose, onOpen }) {
  const [i, setI] = useState(0);
  const slide = slides[i];
  const next = () => setI((v) => Math.min(v + 1, slides.length - 1));
  const prev = () => setI((v) => Math.max(v - 1, 0));
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,15,11,0.92)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={i < slides.length - 1 ? next : undefined}
        style={{
          width: "100%",
          maxWidth: 420,
          minHeight: 260,
          background: CREAM,
          borderRadius: 6,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 2px 0 #DDD1B8",
          padding: "18px 20px 20px",
          color: WALNUT,
          cursor: i < slides.length - 1 ? "pointer" : "default",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* index-card red rule */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 46,
            height: 1.5,
            background: CARD_RULE,
            opacity: 0.55,
          }}
        />
        <div
          style={{
            fontFamily: FUTURA,
            fontSize: 10,
            letterSpacing: "0.18em",
            fontWeight: 700,
            color: "#8A6B2E",
            marginBottom: 24,
          }}
        >
          {slide.eyebrow}
        </div>
        <div
          style={{
            fontFamily: FUTURA,
            fontSize: 19,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 10,
          }}
        >
          {slide.title}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: "#4A3B2C" }}>{slide.body}</div>
        {slide.url && (
          <a
            href={slide.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              if (slide.itemId) onOpen(slide.itemId);
            }}
            style={{
              display: "inline-block",
              marginTop: 14,
              fontFamily: FUTURA,
              fontSize: 11,
              letterSpacing: "0.12em",
              fontWeight: 700,
              color: CREAM,
              background: WALNUT,
              borderRadius: 3,
              padding: "8px 14px",
              textDecoration: "none",
            }}
          >
            OPEN
          </a>
        )}
      </div>

      {/* deck controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18 }}>
        <button
          onClick={prev}
          disabled={i === 0}
          style={{
            background: "none",
            border: "none",
            color: i === 0 ? "#5A4A38" : CREAM,
            fontSize: 22,
            cursor: i === 0 ? "default" : "pointer",
          }}
        >
          ‹
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {slides.map((_, d) => (
            <div
              key={d}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: d === i ? MUSTARD : "#5A4A38",
              }}
            />
          ))}
        </div>
        <button
          onClick={next}
          disabled={i === slides.length - 1}
          style={{
            background: "none",
            border: "none",
            color: i === slides.length - 1 ? "#5A4A38" : CREAM,
            fontSize: 22,
            cursor: i === slides.length - 1 ? "default" : "pointer",
          }}
        >
          ›
        </button>
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: 14,
          fontFamily: FUTURA,
          fontSize: 11,
          letterSpacing: "0.14em",
          fontWeight: 700,
          background: "transparent",
          border: `1px solid #5A4A38`,
          color: CREAM_DIM,
          borderRadius: 4,
          padding: "9px 18px",
          cursor: "pointer",
        }}
      >
        CLOSE
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// ═══ MAIN APP ═══
// ═══════════════════════════════════════════════════════════════════════════════════

export default function Credenza() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [dupe, setDupe] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const [resurfaced, setResurfaced] = useState(null);
  const [digest, setDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const recRef = useRef(null);

  // ————— Race-free mutations (spec §3): no stale-closure array writes —————
  // Updaters stay pure; persistence follows committed state in the effect below.
  const applyUpdate = (fn) => setItems(fn);

  const updateItem = (id, patch) =>
    applyUpdate((list) =>
      list.map((x) =>
        x.id === id
          ? {
              ...x,
              ...(typeof patch === "function" ? patch(x) : patch),
              updatedAt: Date.now(),
            }
          : x
      )
    );

  // Persist every committed change (skip until the initial load lands).
  useEffect(() => {
    if (loaded) saveItems(items);
  }, [loaded, items]);

  // ————— Load + one-time migration + resurfacing pick —————
  useEffect(() => {
    loadItems().then((it) => {
      setItems(it);
      setLoaded(true);
      const pick = pickResurface(it, Date.now());
      if (pick) {
        setResurfaced(pick.id);
        // Bump resurface bookkeeping once, this show (race-free).
        updateItem(pick.id, (x) => ({
          resurfacedCount: (x.resurfacedCount || 0) + 1,
          lastResurfacedAt: Date.now(),
        }));
      }
    });
    const SR =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (SR) setVoiceOk(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ————— Enrichment (async, never blocks capture; failure → status "failed") —————
  // Takes the item object itself: setState updaters run at render time, not call time,
  // so reading a snapshot through one is not reliable mid-handler.
  const runEnrichment = async (item) => {
    updateItem(item.id, { status: "enriching", error: null });
    try {
      const info = await enrichItem(item);
      updateItem(item.id, { ...info, status: "ready", error: null });
    } catch (e) {
      updateItem(item.id, {
        status: "failed",
        error: (e && e.message) || "Enrichment failed.",
      });
    }
  };

  const retry = (id) => {
    const it = items.find((x) => x.id === id);
    if (it) runEnrichment(it);
  };

  // ————— Capture: synchronous, never lost —————
  const capture = () => {
    const raw = input.trim();
    if (!raw) return;
    const parsed = classify(raw);
    const key = canonicalKey(parsed, raw);

    // Duplicate catch on canonicalKey (committed state is current at click time).
    const dupItem = items.find((x) => x.canonicalKey === key) || null;
    if (dupItem) {
      setDupe(dupItem.title);
      setExpandedId(dupItem.id);
      setInput("");
      setTimeout(() => setDupe(null), DUPE_BANNER_MS);
      return;
    }

    const item = createItem(parsed, raw);
    // Persist as "raw" BEFORE any AI call — capture can never be lost.
    applyUpdate((list) => [item, ...list]);
    setInput("");
    // Kick off enrichment async.
    runEnrichment(item);
  };

  // ————— Voice —————
  const toggleVoice = () => {
    const SR =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;
    if (listening) {
      try {
        recRef.current && recRef.current.stop();
      } catch (e) {}
      setListening(false);
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let final = "";
      for (let r = 0; r < ev.results.length; r++) final += ev.results[r][0].transcript;
      setInput(final);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setListening(false);
    }
  };

  // ————— Note save + intent extraction (note persists synchronously) —————
  const saveNote = (id, note) => {
    updateItem(id, { note });
    // Fire-and-forget intent extraction; patches in after.
    const current = items.find((x) => x.id === id);
    extractCardBackIntent(current || { id }, note).then((intent) => {
      updateItem(id, (x) => ({
        extractedIntent: intent.extractedIntent,
        project: intent.project,
        people: intent.people,
        useCase: intent.useCase,
        // Only set importance from extraction if user hasn't moved it off the default.
        importance: x.importance === "medium" ? intent.importance : x.importance,
      }));
    });
  };

  const editItem = (id, patch) => updateItem(id, patch);

  const recordOpen = (id) =>
    updateItem(id, (x) => ({
      lastOpenedAt: Date.now(),
      openCount: (x.openCount || 0) + 1,
    }));

  const remove = (id) => {
    applyUpdate((list) => list.filter((x) => x.id !== id));
    if (expandedId === id) setExpandedId(null);
    if (resurfaced === id) setResurfaced(null);
  };

  const dismissResurfaced = (id) => {
    updateItem(id, { dismissedAt: Date.now() });
    setResurfaced(null);
  };

  // ————— ASK (bounded candidate set, weighs notes/intent) —————
  const ask = async () => {
    const question = search.trim();
    if (!question || asking) return;
    setAsking(true);
    setAnswer(null);
    try {
      const candidates = selectAskCandidates(items, question);
      const text = await askVault(question, candidates);
      setAnswer(text || "No answer came back — try rephrasing.");
    } catch (e) {
      setAnswer("Couldn't reach the assistant. Try again in a moment.");
    }
    setAsking(false);
  };

  // ————— Digest (scoring selects; AI writes words; renders fully without AI) —————
  const buildDigest = async () => {
    if (digestLoading) return;
    const now = Date.now();
    const all = items;
    if (all.length === 0) return;
    setDigestLoading(true);

    const eligible = all.filter((x) => x.status === "ready" || x.status === "failed");
    const weekCount = all.filter((x) => now - x.createdAt < WEEK_MS).length;

    const picks = [...eligible]
      .map((x) => ({ item: x, score: scoreDigestCandidate(x, now) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.item);

    const pickIds = new Set(picks.map((p) => p.id));
    const gemPool = eligible.filter(
      (x) => now - x.createdAt > GEM_MIN_AGE_MS && !pickIds.has(x.id)
    );
    let gem = null;
    if (gemPool.length > 0) {
      gem = gemPool
        .map((x) => ({ item: x, score: scoreForgottenGem(x, now) }))
        .sort((a, b) => b.score - a.score)[0].item;
    }

    let copy;
    try {
      copy = await generateDigestCopy(picks, gem, weekCount);
    } catch (e) {
      copy = { intro: "Here's what deserves a second look this week.", reasons: {}, gemReason: "" };
    }

    const slides = [
      {
        eyebrow: "THIS WEEK ON THE SHELF",
        title: `${weekCount} new ${weekCount === 1 ? "thing" : "things"} stashed`,
        body:
          picks.length === 0
            ? "Still filing this week's stash — deal the deck again once the ink dries."
            : copy.intro || "Here's what deserves a second look.",
      },
    ];
    picks.forEach((it, idx) => {
      slides.push({
        eyebrow: `WORTH YOUR TIME · ${idx + 1}`,
        title: it.title,
        body: (copy.reasons && copy.reasons[it.id]) || it.note || it.summary || "",
        url: it.url,
        itemId: it.id,
      });
    });
    if (gem) {
      slides.push({
        eyebrow: "FROM THE BACK OF THE SHELF",
        title: gem.title,
        body: copy.gemReason || gem.note || gem.summary || "",
        url: gem.url,
        itemId: gem.id,
      });
    }
    slides.push({
      eyebrow: "THAT'S THE DECK",
      title: "Shelf's in good shape.",
      body: "Come back next week — or stash something worth digesting.",
    });

    setDigest(slides);

    // Bump digest bookkeeping on featured items (race-free).
    const featured = [...picks, ...(gem ? [gem] : [])];
    featured.forEach((it) =>
      updateItem(it.id, (x) => ({
        digestCount: (x.digestCount || 0) + 1,
        lastDigestAt: now,
      }))
    );

    setDigestLoading(false);
  };

  // ————— Derived: inbox / shelf / search / resurfaced —————
  const q = search.trim().toLowerCase();

  const inboxItems = useMemo(
    () =>
      items.filter(
        (x) => x.status === "raw" || x.status === "enriching" || x.status === "failed"
      ),
    [items]
  );

  const readyItems = useMemo(() => items.filter((x) => x.status === "ready"), [items]);

  const visible = useMemo(
    () =>
      readyItems.filter((x) => {
        if (filter !== "all" && x.type !== filter) return false;
        if (!q) return true;
        const hay = [
          x.title,
          x.summary,
          x.host,
          x.note,
          x.extractedIntent,
          x.project,
          x.useCase,
          ...(x.people || []),
          ...(x.tags || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      }),
    [readyItems, filter, q]
  );

  const resurfacedItem =
    resurfaced && filter === "all" && !q
      ? items.find((x) => x.id === resurfaced && x.status === "ready")
      : null;
  const shelfItems = resurfacedItem
    ? visible.filter((x) => x.id !== resurfaced)
    : visible;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: WALNUT,
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 7px)",
        color: CREAM,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "0 0 60px",
      }}
    >
      {digest && (
        <DigestDeck slides={digest} onClose={() => setDigest(null)} onOpen={recordOpen} />
      )}

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "26px 16px 0" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FUTURA,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: MUSTARD,
              }}
            >
              CREDENZA
            </div>
            <div style={{ fontSize: 12.5, color: CREAM_DIM, marginTop: 3 }}>
              Everything you meant to come back to.
              {loaded && items.length > 0 && (
                <span style={{ fontFamily: MONO }}> · {items.length} saved</span>
              )}
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={buildDigest}
              style={{
                fontFamily: FUTURA,
                fontSize: 11,
                letterSpacing: "0.14em",
                fontWeight: 700,
                background: "transparent",
                border: `1px solid ${MUSTARD}`,
                color: MUSTARD,
                borderRadius: 4,
                padding: "9px 14px",
                cursor: "pointer",
                marginTop: 4,
                flexShrink: 0,
              }}
            >
              {digestLoading ? "DEALING…" : "DIGEST"}
            </button>
          )}
        </div>

        {/* Capture bar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            background: PANEL_LT,
            border: `1px solid ${listening ? MUSTARD : LINE}`,
            borderRadius: 6,
            padding: 8,
            marginBottom: 10,
            transition: "border-color .2s",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                capture();
              }
            }}
            placeholder={listening ? "Listening…" : "Paste a link, or jot a note…"}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              color: CREAM,
              fontSize: 14,
              lineHeight: 1.45,
              fontFamily: "inherit",
              padding: "6px 4px",
            }}
          />
          {voiceOk && (
            <button
              onClick={toggleVoice}
              title="Dictate a note"
              style={{
                fontSize: 15,
                alignSelf: "stretch",
                background: listening ? MUSTARD : "transparent",
                color: listening ? WALNUT : CREAM_DIM,
                border: `1px solid ${listening ? MUSTARD : LINE}`,
                borderRadius: 4,
                padding: "0 11px",
                cursor: "pointer",
              }}
            >
              ●
            </button>
          )}
          <button
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) setInput(text.trim());
              } catch (e) {}
            }}
            title="Paste from clipboard"
            style={{
              fontFamily: FUTURA,
              fontSize: 11,
              letterSpacing: "0.12em",
              fontWeight: 700,
              alignSelf: "stretch",
              background: "transparent",
              color: CREAM_DIM,
              border: `1px solid ${LINE}`,
              borderRadius: 4,
              padding: "0 12px",
              cursor: "pointer",
            }}
          >
            PASTE
          </button>
          <button
            onClick={capture}
            disabled={!input.trim()}
            style={{
              fontFamily: FUTURA,
              fontSize: 11,
              letterSpacing: "0.14em",
              fontWeight: 700,
              alignSelf: "stretch",
              background: input.trim() ? MUSTARD : LINE,
              color: input.trim() ? WALNUT : CREAM_DIM,
              border: "none",
              borderRadius: 4,
              padding: "0 16px",
              cursor: input.trim() ? "pointer" : "default",
              transition: "background .15s",
            }}
          >
            STASH
          </button>
        </div>

        {dupe && (
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11.5,
              color: MUSTARD,
              border: `1px solid ${MUSTARD}`,
              borderRadius: 5,
              padding: "8px 12px",
              marginBottom: 10,
            }}
          >
            Already on the shelf: "{dupe}" — opened it below.
          </div>
        )}

        {/* Search / Ask */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (answer) setAnswer(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask();
            }}
            placeholder="Search, or ask a question…"
            style={{
              flex: 1,
              background: PANEL,
              border: `1px solid ${LINE}`,
              borderRadius: 5,
              outline: "none",
              color: CREAM,
              fontSize: 13.5,
              padding: "10px 12px",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={ask}
            disabled={asking || !search.trim()}
            style={{
              fontFamily: FUTURA,
              fontSize: 11,
              letterSpacing: "0.14em",
              fontWeight: 700,
              background: "transparent",
              color: search.trim() ? MUSTARD : CREAM_DIM,
              border: `1px solid ${search.trim() ? MUSTARD : LINE}`,
              borderRadius: 5,
              padding: "0 14px",
              cursor: search.trim() ? "pointer" : "default",
            }}
          >
            {asking ? "…" : "ASK"}
          </button>
        </div>

        {/* Answer panel */}
        {answer && (
          <div
            style={{
              background: PANEL_LT,
              border: `1px solid ${MUSTARD}`,
              borderRadius: 6,
              padding: "12px 14px",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontFamily: FUTURA,
                fontSize: 10,
                letterSpacing: "0.16em",
                fontWeight: 700,
                color: MUSTARD,
                marginBottom: 6,
              }}
            >
              FROM THE SHELF
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {answer}
            </div>
            <button
              onClick={() => setAnswer(null)}
              style={{
                marginTop: 10,
                fontFamily: FUTURA,
                fontSize: 10,
                letterSpacing: "0.14em",
                fontWeight: 700,
                background: "transparent",
                border: "none",
                color: CREAM_DIM,
                cursor: "pointer",
                padding: 0,
              }}
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: 7,
            overflowX: "auto",
            paddingBottom: 4,
            marginBottom: 14,
          }}
        >
          {FILTERS.map((f) => (
            <TypeChip key={f} name={f} active={filter === f} onClick={() => setFilter(f)} />
          ))}
        </div>

        {/* Inbox strip (only when non-empty) */}
        <InboxStrip items={inboxItems} onRetry={retry} />

        {/* Resurfaced */}
        {resurfacedItem && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 7,
              }}
            >
              <span
                style={{
                  fontFamily: FUTURA,
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                  color: MUSTARD,
                }}
              >
                FROM THE BACK OF THE SHELF
              </span>
              <button
                onClick={() => dismissResurfaced(resurfacedItem.id)}
                style={{
                  marginLeft: "auto",
                  fontFamily: MONO,
                  fontSize: 10.5,
                  background: "none",
                  border: "none",
                  color: CREAM_DIM,
                  cursor: "pointer",
                }}
              >
                dismiss
              </button>
            </div>
            <Card
              item={resurfacedItem}
              highlight
              expanded={expandedId === resurfacedItem.id}
              onToggle={() =>
                setExpandedId(expandedId === resurfacedItem.id ? null : resurfacedItem.id)
              }
              onDelete={remove}
              onSaveNote={saveNote}
              onEdit={editItem}
              onOpen={recordOpen}
            />
          </div>
        )}

        {/* Shelf */}
        {!loaded ? (
          <div style={{ color: CREAM_DIM, fontSize: 13, padding: "30px 0", textAlign: "center" }}>
            Opening the credenza…
          </div>
        ) : shelfItems.length === 0 && !resurfacedItem && inboxItems.length === 0 ? (
          <div
            style={{
              border: `1px dashed ${LINE}`,
              borderRadius: 6,
              padding: "36px 20px",
              textAlign: "center",
              color: CREAM_DIM,
              fontSize: 13.5,
              lineHeight: 1.6,
            }}
          >
            {items.length === 0
              ? "Empty shelf. Paste your first link above — a YouTube video, a tweet, an article — and it gets titled, summarized, and tagged automatically. Flip any card over to write on the back."
              : "Nothing matches. Clear the search or switch shelves."}
          </div>
        ) : shelfItems.length === 0 ? null : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shelfItems.map((item) => (
              <Card
                key={item.id}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                onDelete={remove}
                onSaveNote={saveNote}
                onEdit={editItem}
                onOpen={recordOpen}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
