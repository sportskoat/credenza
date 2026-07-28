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

import { marketplaceOf, agentOf } from "./agents.js";

const BUY_MARKETPLACES = ["weidian", "taobao", "tmall", "1688"];

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const REDDIT_POST_RE = /https?:\/\/(?:www\.)?reddit\.com\/r\/[\w-]+\/(?:comments|s)\/[^\s<>"')\]]+/;
const REDDIT_USER_RE = /\bu\/([\w-]{3,20})\b/;

// A link an item can hang on: a marketplace, a Yupoo album, or a buy agent
// (incl. short links like k.youshop10.com). Agent links were invisible until
// 2026-07-24 — pastes whose only buy link was an agent link parsed to NOTHING
// and fell through to the generic path as junk cards.
const shoppableOf = (u) => marketplaceOf(u) || agentOf(u);

// Wider net than the AGENTS registry in agents.js (people mention agents we
// don't have URL templates for) — the registry stays canonical for Buy links.
const KNOWN_AGENTS = [
  "superbuy", "sugargoo", "cssbuy", "kakobuy", "hoobuy", "cnfans",
  "mulebuy", "acbuy", "oopbuy", "basetao", "wegobuy", "pandabuy", "allchinabuy", "joyabuy",
  "joyagoo", "mycnbox", "gtbuy", "hipobuy",
];

// Category guesses emit the app's CATEGORIES keys (credenza-fashion.jsx) so
// item.category has one vocabulary end-to-end; order mirrors
// guessFashionCategory's precedence (hoodie → outerwear, crewneck → shirt).
const CATEGORY_KEYWORDS = [
  // EN + FR (FashionReps FR hauls: baskets, ensemble, veste, casquette…)
  ["shoes", /\b(shoes?|sneakers?|jordans?|aj\s?\d{1,2}|dunks?|yeezys?|af1|air force|air max|new balance|nb\s?\d{3,4}|vans|old\s?skool|sk8|asics|gel-\w+|fresh foam|boots?|slides?|runners?|trainers?|baskets?|chaussures?|sneakers?)\b/i],
  ["outerwear", /\b(hoodie|jacket|coat|puffer|windbreaker|parka|bomber|denim jacket|varsity|veste|blouson|doudoune|manteau|coupe-?vent|anorak)\b/i],
  ["shorts", /\bshorts?\b/i],
  ["pants", /\b(pants|jeans?|trousers|cargos?|sweatpants|joggers?|track pants|pantalons?|jeans?)\b/i],
  ["socks", /\b(socks?|chaussettes?)\b/i],
  ["hat", /\b(hat|cap|beanie|casquette|bonnet|chapeau)\b/i],
  ["bag", /\b(bag|backpack|tote|duffel|crossbody|shoulder bag|sacs?|sac\s?[àa]\s?dos)\b/i],
  ["accessory", /\b(belt|sunglasses|glasses|watch|ring|necklace|bracelet|wallet|scarf|gloves?|ceinture|montre|lunettes|portefeuille|gants?)\b/i],
  // "ensemble" (FR tracksuit/set) and tees before bare "shirt"
  ["shirt", /\b(tees?|t-shirts?|tshirts?|shirts?|polos?|tanks?|henleys?|crewnecks?|sweatshirts?|sweaters?|knits?|cardigans?|vests?|longsleeves?|long\s*sleeves?|chemises?|pulls?|maillots?|ensembles?)\b/i],
];

function guessCategory(label) {
  if (!label) return "";
  for (const [category, re] of CATEGORY_KEYWORDS) {
    if (re.test(label)) return category;
  }
  return "";
}

// Normalize a size token to a short posterSize string (M, XL, EU 43.5, 28…).
function normalizeSizeToken(raw) {
  if (!raw) return "";
  let s = String(raw).trim().replace(/,/g, ".");
  s = s.replace(/\s+/g, " ");
  // Letter sizes stay upper-case.
  if (/^x{0,2}[sml]$/i.test(s) || /^x{0,2}l$/i.test(s) || /^xx?xl$/i.test(s)) {
    return s.toUpperCase();
  }
  // EU/US/UK prefixes
  const region = /^(eu|us|uk)\s*(\d{1,2}(?:\.\d+)?)$/i.exec(s);
  if (region) return region[1].toUpperCase() + " " + region[2];
  // Bare numeric shoe/pant size
  if (/^\d{1,2}(?:\.\d+)?$/.test(s)) return s;
  return s.slice(0, 16);
}

// Pull posterSize / sizeNotes / weightGrams out of free-text notes so import
// can land structured fields (edge: notes hard-sliced at 500 chars drop fit).
// Does not invent data — only clear size/weight tokens and short fit phrases.
export function structureItemFields(item) {
  const out = {
    posterSize: item.posterSize || "",
    sizeNotes: item.sizeNotes || "",
    weightGrams:
      typeof item.weightGrams === "number" && item.weightGrams > 0
        ? Math.round(item.weightGrams)
        : null,
    note: item.note || "",
  };
  let note = out.note;
  if (!note) return out;

  // Explicit meta keys first: "Taille : M", "Size: EU 43.5", "Pointure : 43"
  const sizeKeyRe =
    /(?:^|[.\s])(?:taille|pointure|size|shoe\s*size|fit\s*size)\s*[:：]?\s*(eu\s*)?(\d{1,2}(?:[.,]\d+)?|x{0,3}[sml]|xxl)(?:\s*(eu|us|uk))?/gi;
  let m;
  const sizeHits = [];
  while ((m = sizeKeyRe.exec(note)) !== null) {
    const region = (m[1] || m[3] || "").trim();
    const token = normalizeSizeToken((region ? region + " " : "") + m[2]);
    if (token) sizeHits.push({ token, index: m.index, end: m.index + m[0].length, raw: m[0] });
  }
  // "I took size M" / "size XL fits" when no key-form hit yet
  if (sizeHits.length === 0) {
    const took = /\b(?:took|take|wear(?:ing)?|ordered)\s+size\s+(x{0,3}[sml]|xxl|\d{1,2}(?:[.,]\d+)?)\b/i.exec(
      note
    );
    if (took) {
      sizeHits.push({
        token: normalizeSizeToken(took[1]),
        index: took.index,
        end: took.index + took[0].length,
        raw: took[0],
      });
    } else {
      const bare = /\bsize\s+(x{0,3}[sml]|xxl)\b/i.exec(note);
      if (bare) {
        sizeHits.push({
          token: normalizeSizeToken(bare[1]),
          index: bare.index,
          end: bare.index + bare[0].length,
          raw: bare[0],
        });
      }
    }
  }
  // Standalone "EU 43.5" / "US 9" near the start of the note (common FR/QC)
  if (sizeHits.length === 0) {
    const eu = /\b((?:EU|US|UK)\s*\d{1,2}(?:[.,]\d+)?)\b/i.exec(note);
    if (eu && eu.index < 80) {
      sizeHits.push({
        token: normalizeSizeToken(eu[1]),
        index: eu.index,
        end: eu.index + eu[0].length,
        raw: eu[0],
      });
    }
  }
  if (sizeHits.length && !out.posterSize) {
    out.posterSize = sizeHits[0].token;
  }

  // Item weight: "Poids : 850g", "weight: 0.85 kg" — not haul totals like "15kg haul"
  const wKey =
    /(?:^|[.\s])(?:poids|weight|item\s*weight|ship(?:ping)?\s*weight)\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(kg|g|grams?|grammes?)?\b/i.exec(
      note
    );
  if (wKey && out.weightGrams == null) {
    const n = parseFloat(wKey[1].replace(",", "."));
    const unit = (wKey[2] || "g").toLowerCase();
    if (Number.isFinite(n) && n > 0) {
      out.weightGrams = unit.startsWith("kg") ? Math.round(n * 1000) : Math.round(n);
      // Guard absurd per-item weights (haul totals mis-tagged)
      if (out.weightGrams > 8000) out.weightGrams = null;
    }
  }

  // Fit chatter → sizeNotes (keep short; full review stays in note)
  const fitBits = [];
  const fitRe =
    /\b(runs?\s+(?:a\s+)?(?:size\s+)?(?:small|big|large|long|short)|size\s+up|size\s+down|true\s+to\s+size|tts|fits?\s+(?:me\s+)?(?:perfect|well|loose|tight|baggy|cropped|small|big|large|true)|cropped|boxy|oversized|baggy|slim\s+fit|loose\s+fit)\b[^.!?\n]{0,40}/gi;
  let fm;
  while ((fm = fitRe.exec(note)) !== null) {
    const bit = fm[0].trim().replace(/\s+/g, " ");
    if (bit.length >= 4 && !fitBits.includes(bit)) fitBits.push(bit);
    if (fitBits.length >= 3) break;
  }
  // Chart-ish measurement lines
  const chartRe =
    /\b(?:chest|bust|length|shoulder|sleeve|waist|inseam|thigh|poitrine|longueur|manches?)\s*[:：]?\s*\d{2,3}(?:[.,]\d+)?\s*cm\b/gi;
  let cm;
  while ((cm = chartRe.exec(note)) !== null) {
    const bit = cm[0].trim();
    if (!fitBits.includes(bit)) fitBits.push(bit);
    if (fitBits.length >= 6) break;
  }
  if (fitBits.length && !out.sizeNotes) {
    out.sizeNotes = fitBits.join("; ").slice(0, 400);
  }

  // Prefer a tidy note: drop pure "Taille : M" / "Poids : 850g" lines when we
  // already structured them, keep review sentences.
  if (out.posterSize || out.weightGrams != null) {
    const cleaned = note
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) return false;
        if (
          out.posterSize &&
          /^(taille|pointure|size)\s*[:：]?\s*/i.test(line) &&
          line.length < 40
        ) {
          return false;
        }
        if (
          out.weightGrams != null &&
          /^(poids|weight)\s*[:：]?\s*/i.test(line) &&
          line.length < 40
        ) {
          return false;
        }
        return true;
      })
      .join("\n")
      .trim();
    // Single-line notes: strip leading "Taille : M " residue when it was inline
    let oneLine = cleaned;
    if (out.posterSize) {
      oneLine = oneLine
        .replace(
          /(?:^|\s)(?:taille|pointure|size)\s*[:：]?\s*(?:eu\s*)?(?:\d{1,2}(?:[.,]\d+)?|x{0,3}[sml]|xxl)(?:\s*(?:eu|us|uk))?\s*/i,
          " "
        )
        .replace(/\s{2,}/g, " ")
        .trim();
    }
    if (out.weightGrams != null) {
      oneLine = oneLine
        .replace(
          /(?:^|\s)(?:poids|weight)\s*[:：]?\s*\d+(?:[.,]\d+)?\s*(?:kg|g|grams?|grammes?)?\s*/i,
          " "
        )
        .replace(/\s{2,}/g, " ")
        .trim();
    }
    out.note = oneLine || cleaned || note;
  }

  return out;
}

// ————— URL deobfuscation —————————————————————————————————————————————————————
// FashionReps posters dodge automod by breaking URLs with spaces:
//   "https:/ /item. ta oba o.co m /item.htm?id=902046907188"
//   "https://de tail.1688.com/offer/940644075601.html"
// Rejoin the fragments so the link parses as one URL. A fragment joins when:
//   - the scheme is still open ("https:/" + "/item."), or
//   - the host has no known TLD ending yet ("ta" + "oba" + "o.co" + "m"), or
//   - the fragment starts with "/" (path continuation: ".com" + "/item.htm").
// Anything else stops the join, so "https://taobao.com is great" keeps its prose.
const KNOWN_TLD_RE =
  /\.(com|cn|net|org|io|shop|vip|me|app|dev|gg|tv|cc|co\.cn|com\.cn|net\.cn|de|fr|jp|kr|hk|tw|ru)$/i;

// Reddit often autolinks bare marketplace ids as phone numbers inside the URL:
//   https://weidian.com/item.html?itemID=[7779496523](tel:7779496523)
// Restore the numeric id so the line stays one shoppable Weidian/Taobao link
// (15kg GTBuy haul corpus, 2026-07-25).
export function repairTelLinkedItemIds(text) {
  if (!text || typeof text !== "string" || !/\]\(tel:/i.test(text)) return text;
  return text
    .replace(
      /\b(itemID|itemId|item_id|id)=\[(\d{5,})\]\(tel:\2\)/gi,
      "$1=$2"
    )
    .replace(
      /\b(itemID|itemId|item_id|id)=\[(\d{5,})\]\(tel:\d+\)/gi,
      "$1=$2"
    );
}

export function deobfuscateUrls(text) {
  if (!text || typeof text !== "string" || text.indexOf("http") === -1) return text;
  return text.replace(/https?:\/ ?\S*(?: \S+){0,8}/g, (candidate) => {
    if (!/\s/.test(candidate)) return candidate; // already one solid token
    const tokens = candidate.split(/\s+/);
    let url = tokens[0];
    let i = 1;
    for (; i < tokens.length; i++) {
      const tok = tokens[i];
      const schemeRest = url.replace(/^https?:/i, "");
      if (schemeRest === "/" || schemeRest === "") {
        url += tok; // "https:/" + "/item." → "https://item."
        continue;
      }
      const host = url.replace(/^https?:\/\/?/i, "").split("/")[0];
      if (!KNOWN_TLD_RE.test(host) || tok.startsWith("/")) {
        url += tok;
        continue;
      }
      // Host-only URL + a path written as the next token — posters dodge
      // automod this way too: "https://huskyreps.x.yupoo.com/ albums/2125…".
      // Prose after a complete URL does not start with "word/…".
      const pathSoFar = url.replace(/^https?:\/\/?/i, "").split("/").slice(1).join("/");
      if (!pathSoFar && /^[\w-]+\/\S*$/.test(tok)) {
        url += tok;
        continue;
      }
      break;
    }
    // "https:/item." (one slash survived) → "https://item."
    url = url.replace(/^(https?:)\/(?!\/)/i, "$1//");
    const rest = tokens.slice(i).join(" ");
    return rest ? url + " " + rest : url;
  });
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
    // Residue from Reddit phone-autolinked ids: "white ](tel:777…)"
    .replace(/\s*\]\(tel:\d+\)/gi, "")
    .replace(/^[|\s\-*•>”"`]+|[|\s]+$/g, "")
    // "w2c => url", "W2C: url", "w2c -> url" — the arrow is not the product name
    .replace(/\b(w2c|w2b|wtc|find|gp'?d|qc|in\s?hand|review|link|lien|yupoo)\b\s*[:：=.\-–—>]{0,3}\s*/gi, "")
    // "on these Birkenstock shoes" / "on this hoodie" — deictic filler from QC titles
    .replace(/^on\s+the(?:se|is)\s+/i, "")
    .replace(/[|–—]+/g, " ")
    // "Black jeans:" / "LJR TS: -" / "Pearlized Vans =" — the name-link
    // separator is not the name.
    .replace(/[\s:：\-–—=]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Contact channels and pure hosts are never product names (SwagSupply "WhatsApp"
// card, bare discord/telegram anchors).
function isUsableLabel(label) {
  if (!label || label.length < 3) return false;
  if (/^(whats?\s?app|telegram|discord|wechat|instagram|\.?ig)$/i.test(label)) return false;
  if (/^(https?:\/\/|[\w.-]+\.(com|cn|net|org|io|shop|vip)\/?)/i.test(label)) return false;
  return true;
}

// Product names are short. Long first-person review lines that rode in as the
// "label" from same-line text (99team) must not title a card.
function isProductLikeLabel(label) {
  if (!isUsableLabel(label)) return false;
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length > 10) return false;
  if (label.length > 70) return false;
  if (
    /\b(i|i'?m|i'?ve|we|my|me|please|wondering|ordered|anyone|any\s*one|does anyone|help me|what do you)\b/i.test(
      label
    )
  ) {
    return false;
  }
  // Full sentences that end with .!? and still look like prose.
  if (words.length >= 6 && /[.!?]$/.test(label)) return false;
  return true;
}

// Yupoo seller home pages (no /albums/ or /categories/) are storefront chrome.
// When the same host already contributed an album/category item, drop the root
// so husky-style posts stop tripling one seller (album + root + root mirror).
function pruneRedundantYupooRoots(items) {
  const keepHosts = new Set();
  for (const it of items) {
    try {
      const u = new URL(it.url);
      if (!/yupoo\.com$/i.test(u.hostname)) continue;
      if (/\/(albums|categories)\//i.test(u.pathname)) {
        keepHosts.add(u.hostname.toLowerCase());
      }
    } catch {
      /* ignore bad urls */
    }
  }
  if (keepHosts.size === 0) return items;
  return items.filter((it) => {
    try {
      const u = new URL(it.url);
      if (!/yupoo\.com$/i.test(u.hostname)) return true;
      const path = (u.pathname || "/").replace(/\/+$/, "") || "/";
      if (path === "/" && keepHosts.has(u.hostname.toLowerCase())) return false;
      return true;
    } catch {
      return true;
    }
  });
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
// A short product head for "Name - review" / bare name-above-link lines when
// the prior item's review is still in pending (atBoundary false). Without this
// the next name line stays chatter on the previous card (Shiba numbered hauls).
// Fit advice and all-lowercase review phrases must never pass.
function isShortProductHead(head) {
  const h = (head || "").trim();
  if (h.length < 3 || h.length > 70) return false;
  const words = h.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 10) return false;
  if (/[.!?…]$/.test(h)) return false;
  // Review lists and asides use commas; product titles rarely do.
  if (/,/.test(h)) return false;
  if (/\b(i|i'?m|i'?ve|we|my|me|please|anyone|ordered|wondering)\b/i.test(h)) return false;
  if (/\b(haul|review)\b/i.test(h) || /^\d+(?:\.\d+)?\s?kg\b/i.test(h)) return false;
  // "Size up once" / "runs small" are fit notes, not product names.
  if (
    /\b(size\s+up|size\s+down|runs?\s+(?:a\s+)?(?:size\s+)?(?:small|big|large)|true\s+to\s+size|tts|fits?\s+(?:me\s+)?(?:perfect|well|loose|tight|baggy|cropped|small|big))\b/i.test(
      h
    )
  ) {
    return false;
  }
  // Product titles are almost always title-case or ALLCAPS/brand codes.
  // All-lowercase review ("great blank", "heavy fabric") stays as note.
  if (!/[A-ZÀ-ÖØ-Þ]/.test(h)) return false;
  return true;
}

function headerSplit(line, { atBoundary, nearestToUrl = false }) {
  // "(Remove space or check discord logo)" — a parenthesized aside is an
  // instruction to the reader, never an item name.
  if (/^\(.*\)$/.test(line)) return null;
  const dash = /^(.{3,90}?)\s+[-–—]\s+(.+)$/.exec(line);
  const hasSize = HEADER_SIZE_RE.test(line);
  const postChatter = (s) => /\b(haul|review)\b/i.test(s) || /^\d+(?:\.\d+)?\s?kg\b/i.test(s);
  // A line immediately above the W2C URL is the usual product header even when
  // intro chatter sits earlier in the same pending buffer (numbered hauls).
  const asHeader = atBoundary || nearestToUrl;
  // Dash headers fire at a block start, with a size parenthetical, OR when the
  // left side is a short product head (next "Name - review" after prior prose).
  if (
    dash &&
    (hasSize || asHeader || isShortProductHead(dash[1])) &&
    !postChatter(dash[1])
  ) {
    return { label: cleanLabel(dash[1]), note: dash[2].trim() };
  }
  if (hasSize && asHeader && !postChatter(line)) return { label: cleanLabel(line), note: "" };
  // "Goyard bag: good quality, the material is thinner…" — the dominant haul
  // review format (2026-07-24 corpus: 15kg GTBuy haul). Name before the colon,
  // review after. The head must look like a product name: short, few words, no
  // sentence punctuation — "For the price its very good: …" is prose, not a
  // header. Stopword lead-ins ("Note:", "Edit:") are out too; cleanLabel
  // already empties w2c/qc/review/link heads.
  const colon = /^(.{3,40}?)\s*[:：]\s+(.+)$/.exec(line);
  if (colon && !postChatter(colon[1])) {
    // Strip a leading emoji before classifying the key ("👕 Article 1 : …").
    const rawKey = colon[1].trim().replace(/^[^\p{L}\p{N}]+/u, "").trim();
    // "Article 2 : Nike shorts" — the number is decoration; the VALUE names
    // the item (numbered haul lists, EN + FR — 2026-07-25 HIPOBUY audit).
    if (/^(article|item|pi[èe]ce|produit|product)\s*\d+\s*$/i.test(rawKey)) {
      const label = cleanLabel(colon[2]);
      if (label.length > 2) return { label, note: "" };
      return null;
    }
    // Meta keys are item attributes, never item names — "Taille : M" and
    // "Avis (9/10) : …" stay in the note flow or the card ships titled
    // "Taille" (2026-07-25 HIPOBUY audit).
    if (
      /^(taille|size|pointure|poids|weight|prix|price|co[uû]t|cost|agent|destination|lien|links?|livraison|shipping|batch|colorway|couleur|colou?r|w2c|wtc|qc|avis|review|rating|d[ée]lai( de livraison)?|delay|ligne d['’]exp[ée]dition)(\s*\(.*\))?$/i.test(
        rawKey
      )
    ) {
      return null;
    }
    if (
      rawKey.split(/\s+/).length <= 5 &&
      !/[.!?…,]/.test(rawKey) &&
      !/^(note|ps|p\.s|edit|update|tip|tl;?dr)$/i.test(rawKey)
    ) {
      const label = cleanLabel(colon[1]);
      if (label.length > 2) return { label, note: colon[2].trim() };
    }
  }
  // Bare product name above a W2C link — the dominant numbered-haul format
  // ("1. CA Shirts from FireRep\nw2c => https://…"). nearestToUrl is true for
  // the last pending line (Shiba 25kg Fansbuy, 2026-07-25).
  if (line.length <= 90 && !postChatter(line) && (asHeader || isShortProductHead(line))) {
    // Sentence-break split only at a true block boundary (opening QC questions).
    // Never treat "great blank, heavy fabric" as a product title mid-buffer.
    if (atBoundary) {
      const split = /^(.{3,60}?)[!?…]\s*(.+)$/.exec(line);
      if (split) {
        const label = cleanLabel(split[1]);
        if (label.length > 2) return { label, note: split[2].trim() };
        return null;
      }
      // Comma only when the head still looks like a product (not review lists).
      const comma = /^(.{3,60}?)[,;]\s*(.+)$/.exec(line);
      if (comma && isShortProductHead(comma[1])) {
        const label = cleanLabel(comma[1]);
        if (label.length > 2) return { label, note: comma[2].trim() };
      }
    }
    if (line.length <= 70 && !/[.!?…,]$/.test(line) && !/,/.test(line)) {
      // Pipe batch titles: "VNS Souvenir | DOG Batch from ElderlyDogs"
      const flat = line.replace(/\s*[|｜]\s*/g, " ");
      if (/\s*[|｜]\s*/.test(line) && isShortProductHead(flat)) {
        return { label: cleanLabel(flat), note: "" };
      }
      if (asHeader || isShortProductHead(line)) {
        const label = cleanLabel(line);
        if (label.length > 2) return { label, note: "" };
      }
    }
  }
  return null;
}

// Agent signup links are not items. "Cssbuy agent: cssbuy.com/register?invite=…"
// rode a 2026-07-24 corpus haul in as a 15th card — it is a referral landing
// page, not a product. Product links with tracking params (mycnbox referId)
// keep their place: the filter matches the PATH, not the query.
const AGENT_SIGNUP_RE = /\/(register|signup|sign-up|login|affiliate)(\/|[?#]|$)/i;

function pickPrimaryUrl(urls) {
  let best = null;
  let bestRank = -1;
  for (const u of urls) {
    const mp = marketplaceOf(u);
    let rank = 0;
    if (mp && BUY_MARKETPLACES.includes(mp)) rank = 3;
    else if (mp === "yupoo") rank = 2;
    else if (agentOf(u)) rank = 2; // an agent buy link beats random prose links
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
  // Text above the FIRST link has no previous item to review. On a single-item
  // post it is that item's review (corpus: the Gats QC post) — keep it aside.
  let leadingChatter = [];

  const flushPendingToNote = () => {
    if (lastItem && pending.length) {
      const snippet = pending.join(" ");
      lastItem.note = lastItem.note ? lastItem.note + " " + snippet : snippet;
    } else if (!lastItem && pending.length) {
      leadingChatter = leadingChatter.concat(pending);
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
    // Anchor text that just repeats the URL ("[https://…](https://…)") or a
    // generic word ("[Lien](…)", "[link](…)", "[W2C](…)") carries no label —
    // treat the link as bare so the header buffer / post title can name it.
    const mdLinks = [];
    const withoutMd = line.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_all, label, url) => {
      const text = label.trim();
      const usable =
        text &&
        text !== url &&
        !/^(link|lien|here|cliquez?|click( here)?|w2c|wtc|w2b|yupoo|whats ?app|telegram|wechat|discord)\.?$/i.test(text) &&
        // "[huskyreps.x.yupoo.com](http://huskyreps.x.yupoo.com)" — a bare host
        // or URL in the anchor is not a label either.
        !/:\/\//.test(text) &&
        !/^[\w.-]+\.(com|cn|net|org|io|shop|vip)(\/?[^\s]*)?$/i.test(text);
      mdLinks.push({ label: usable ? text : "", url });
      return " " + url + " "; // keep URL visible to the generic pass
    });

    // A path written right after a markdown link ("[https://x.yupoo.com/]
    // (https://x.yupoo.com/) albums/2125…") is one URL — the markdown close
    // paren hid it from deobfuscateUrls. Join on the trailing slash; prose
    // after a complete URL does not start with "word/…".
    const joined = withoutMd.replace(
      /(https?:\/\/[^\s<>"')\]]+\/) +([\w-]+\/\S*)/g,
      "$1$2"
    );

    // Trim terminal punctuation the same way the app's extractUrls does: a
    // pasted "…itemID=123," kept the comma, the id regex failed, and the card
    // never resolved nor deduped (parser audit 2026-07-27, fix 1 — the Reddit
    // path had the same bug as the messy-lines path).
    const urls = (joined.match(URL_RE) || [])
      .map((u) => u.replace(/[),.;:!?'"\]]+$/, ""))
      .filter((u) => !(agentOf(u) && AGENT_SIGNUP_RE.test(u)));
    const shoppable = urls.filter(shoppableOf);

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
      // 600 chars: QC reviews run long (corpus Gats post: 380), page chrome
      // comes in many short lines instead of one long one.
      if (stripped.length <= 600) {
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
        joined.replace(URL_RE, " ").replace(/^[\s\-*•>”"`]*(?:\d+[.)])?\s*/, "")
      );
    }

    // No inline label → the buffered text above is probably this item's header
    // ("Name (Size M) - review…" on the line above the W2C link). Walk the
    // buffer BACKWARD from the URL line: the nearest header-like line wins.
    // Attribute lines between the name and the link ("Taille : M" under
    // "Article 2 : Nike…") must not hide the name (2026-07-25 HIPOBUY audit),
    // and review chatter for the previous item sits earlier in the same
    // buffer. Anything before/after the header keeps its old home: previous
    // item's note / this item's note.
    let note = "";
    let fromContext = false;
    if (!label && pending.length) {
      let headerIdx = -1;
      let header = null;
      for (let i = pending.length - 1; i >= 0; i--) {
        header = headerSplit(pending[i], {
          atBoundary: i === 0 && pendingBoundary,
          // The line immediately above the URL is the product header even when
          // earlier pending lines are still review chatter for the prior item.
          nearestToUrl: i === pending.length - 1,
        });
        if (header) {
          headerIdx = i;
          break;
        }
      }
      if (header && header.label.length > 2) {
        label = header.label;
        note = [header.note, ...pending.slice(headerIdx + 1)].filter(Boolean).join(" ").trim();
        pending = pending.slice(0, headerIdx); // earlier lines stay with the previous item
        fromContext = true;
      }
    }
    // Whatever the buffer wasn't consumed as a header is review chatter for
    // the previous item (the pre-2026-07-22 behavior for ALL buffered text).
    flushPendingToNote();

    // A label that is itself a URL/host is no label — better empty than a
    // card titled "https://weidian.com/item.html?itemID=…".
    const finalLabel =
      label.length > 2 && !/^(https?:\/\/|[\w.-]+\.(com|cn|net)\/)/i.test(label) ? label : "";
    const item = {
      url: primary,
      label: finalLabel,
      note,
      category: guessCategory(finalLabel),
      rawLine: line,
      fromContext,
    };
    items.push(item);
    lastItem = item;
    boundary = false;
  }
  flushPendingToNote();
  // Single-item post: the text above the only link is that item's review
  // (the Gats QC post). Multi-item posts keep dropping it — it is the intro.
  if (items.length === 1 && !items[0].note && leadingChatter.length) {
    items[0].note = leadingChatter.join(" ");
  }
  return items;
}

// ————— Public API —————————————————————————————————————————————————————————————

// A post title names a single-item post better than any mid-sentence line the
// header buffer caught (2026-07-24 corpus: "QC NB 9060 TOP batch, what do you
// think?" titled the card "This is my second pair"). Strip the [QC]/[FIND]
// flair, take the lead segment up to the first sentence break or " - ", and
// run it through the same label cleaning as inline text.
function titleLabel(title) {
  if (!title) return "";
  const raw = String(title);
  // Bare flair brackets, then unbracketed "QC" / "(QC)" / trailing "(QC)".
  let noFlair = raw
    .replace(/\[(?:qc|find|review|w2c|gp|lc)\]\s*/gi, "")
    .replace(/^\(?\s*qc\s*\)?\s*[-–—:]?\s*/i, "")
    .replace(/\s*\(\s*qc\s*\)\s*$/i, "")
    .replace(/\s+qc\s*$/i, "");
  // Seller-promo titles bury the product after a colon
  // ("Husky-reps🔥 Guys, I'm bringing…: 🔥TNF …"). Prefer the tail when the
  // head is address/promo chatter.
  if (/\b(guys|i'?m bringing|most proud|welcome to|join my)\b/i.test(noFlair) && /:/.test(noFlair)) {
    const tail = noFlair.split(/:/).slice(1).join(":").trim();
    if (tail.length > 3) noFlair = tail;
  }
  // cleanLabel first: it strips a leading "Review:"/"QC" so the chatter guard
  // below only fires on titles that are ABOUT a haul, not tagged as one.
  let cleaned = cleanLabel(noFlair);
  // Promo tails often continue as sentences after the product token
  // ("TNF nuptse is back. Sorry I was absent…") — keep a short product head.
  cleaned = cleaned.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  {
    // Allow emoji/punctuation between the product and the verb
    // ("TNF 96n*pt*e 🔥is back…").
    const promoCut =
      /^(.{3,40}?)(?:[^\p{L}\p{N}]*\s*(?:is|are|was|were|looks?|seems?|coming|back)\b|(?<!\d)[.!?…](?!\d)|$)/iu.exec(
        cleaned
      );
    if (promoCut) cleaned = promoCut[1].trim();
  }
  cleaned = cleaned.replace(/[^\p{L}\p{N}]+$/u, "").trim();
  // Strip a trailing parenthetical flair again after clean (… (QC)).
  cleaned = cleaned.replace(/\s*\(\s*(?:qc|find|w2c|review|gp|lc)\s*\)\s*$/i, "").trim();
  if (!isUsableLabel(cleaned)) return "";
  // "15kg haul to EU with GTBuy (Goyard, …)" names a batch, not an item —
  // the same guard headerSplit uses on post-title lines.
  if (/\b(haul|review)\b/i.test(cleaned) || /^\d+(?:\.\d+)?\s?kg\b/i.test(cleaned)) return "";
  // Question posts ("Any one ordered S batch 99team?", "looks good?") are
  // chatter, not product names — unless the cleaned head is still a short
  // product phrase after deictic strip ("Birkenstock shoes").
  if (
    /\?/.test(raw) &&
    /^(any(?:\s*one)?|anyone|does|did|is|are|has|have|who|what|where|can|should|would|could)\b/i.test(
      cleaned
    )
  ) {
    return "";
  }
  // Leftover promo heads after failed colon pull.
  if (/\b(guys|i'?m bringing|most proud|welcome to)\b/i.test(cleaned)) return "";
  // Split on sentence punctuation, but never on a version dot ("KZ 2.0 J4").
  const head = /^(.{3,60}?)(?:(?<!\d)[.!?…](?!\d)|[,;]|\s+[-–—]\s+|$)/.exec(cleaned);
  const label = cleanLabel(head ? head[1] : cleaned);
  return isProductLikeLabel(label) ? label : "";
}

// Returns null when the paste isn't haul-shaped (caller falls through to the
// generic import path). Otherwise:
//   { items: [{url, label, note, category, rawLine, posterSize?, sizeNotes?,
//              weightGrams?}],
//     stats: {heightCm?, weightKg?, usualSize?, agent?, budget?, budgetCurrency?},
//     poster: string|null, sourceUrl: string|null, fromPost: boolean, title: string }
// opts.title    — the Reddit post title, when the caller fetched one. Names
//                 single-item posts and unlabeled items.
// opts.fromPost — the text is known to be a fetched Reddit post body. Provenance
//                 is certain, so a single shoppable link is enough — most QC
//                 posts are exactly that (2026-07-24 corpus: 8 of 22 posts).
export function parseRedditHaul(text, opts = {}) {
  const { title = "", fromPost = false } = opts;
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  // JSON/HTML have their own paths. A leading "[{" or '["' is a JSON array; a
  // leading "[" alone is a markdown link (a link-list paste is haul input).
  if (!trimmed || trimmed.startsWith("<") || /^[{]/.test(trimmed) || /^\[\s*[{"]/.test(trimmed)) {
    return null;
  }

  // Repair space-broken URLs before any line work — obfuscated links
  // otherwise read as URL-free chatter and the whole paste falls through.
  // Reddit's markdown escapes ("spider\_token") go at the same time.
  // Phone-autolinked marketplace ids (itemID=[n](tel:n)) restore next.
  const clean = repairTelLinkedItemIds(
    deobfuscateUrls(trimmed).replace(/\\(?=[_*~])/g, "")
  );

  let items = pruneRedundantYupooRoots(extractItems(clean));
  // Contact-channel and review-prose "labels" become empty so titleLabel can
  // recover a real name (or the card stays honestly untitled).
  for (const it of items) {
    if (!isProductLikeLabel(it.label)) {
      it.label = "";
      it.category = "";
    }
  }
  if (items.length === 0) return null;

  const sourceMatch = REDDIT_POST_RE.exec(clean);
  const userMatch = REDDIT_USER_RE.exec(clean);
  const stats = parseStats(clean);
  const hasStats = Object.keys(stats).length > 0;

  // Haul shape: multiple shoppable links, or one link with reddit provenance,
  // a stats block, a fetched-post body, or a title pulled from the surrounding
  // text (a copied QC/review post body — Kyle's 2026-07-24 paste: title line +
  // review + one agent link). A lone link with inline-only text ("check this
  // out <url>") falls through to the generic path, which cards it fine on its
  // own.
  if (items.length === 1 && !sourceMatch && !hasStats && !items[0].fromContext && !fromPost) {
    return null;
  }

  // The post title names what inline text could not. Single-item posts take it
  // outright (the title IS the item name on a QC post). Multi-item posts never
  // stamp the same title on every unlabeled card (edge: seller-promo-title-
  // fill-all-items). Haul/batch titles stay empty; seller-promo product tails
  // (TNF …) fill only the first empty card — the primary SKU of the post.
  const fromTitle = titleLabel(title);
  if (fromTitle) {
    if (items.length === 1) {
      items[0].label = fromTitle;
      items[0].category = guessCategory(fromTitle);
    } else {
      // Multi-item: fill at most the first empty label with a product tail.
      // Pure haul titles never produce fromTitle (titleLabel rejects them);
      // seller-promo tails (TNF …) land on the primary album only.
      const firstEmpty = items.find((it) => !isUsableLabel(it.label));
      if (firstEmpty) {
        firstEmpty.label = fromTitle;
        firstEmpty.category = firstEmpty.category || guessCategory(fromTitle);
      }
    }
  }

  // Final pass: drop labels that still look like prose or contact chrome,
  // then structure size/weight out of the note into dedicated fields.
  for (const it of items) {
    if (!isProductLikeLabel(it.label)) {
      it.label = "";
      it.category = "";
    } else {
      it.category = it.category || guessCategory(it.label);
    }
    // Guess from note when the label is a colorway-only token ("white", "blue")
    // but the note names the product class (French FR hauls).
    if (!it.category && it.note) {
      it.category = guessCategory(it.note.slice(0, 120));
    }
    const structured = structureItemFields(it);
    it.posterSize = structured.posterSize;
    it.sizeNotes = structured.sizeNotes;
    it.weightGrams = structured.weightGrams;
    it.note = structured.note;
  }

  return {
    items,
    stats,
    poster: userMatch ? userMatch[1] : null,
    sourceUrl: sourceMatch ? sourceMatch[0] : null,
    fromPost: !!fromPost,
    title: title || "",
  };
}
