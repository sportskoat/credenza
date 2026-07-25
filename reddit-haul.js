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
  ["shoes", /\b(shoes?|sneakers?|jordans?|aj\s?\d{1,2}|dunks?|yeezys?|af1|air force|air max|new balance|nb\s?\d{3,4}|vans|old\s?skool|sk8|asics|gel-\w+|fresh foam|boots?|slides?|runners?|trainers?)\b/i],
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
    .replace(/^[|\s\-*•>”"`]+|[|\s]+$/g, "")
    .replace(/\b(w2c|w2b|find|gp'?d|qc|in\s?hand|review|link|lien|yupoo)\b\s*[:：-]?\s*/gi, "")
    .replace(/[|–—]+/g, " ")
    // "Black jeans:" / "LJR TS: -" / "Pearlized Vans =" — the name-link
    // separator is not the name.
    .replace(/[\s:：\-–—=]+$/g, "")
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
  // "(Remove space or check discord logo)" — a parenthesized aside is an
  // instruction to the reader, never an item name.
  if (/^\(.*\)$/.test(line)) return null;
  const dash = /^(.{3,90}?)\s+[-–—]\s+(.+)$/.exec(line);
  const hasSize = HEADER_SIZE_RE.test(line);
  const postChatter = (s) => /\b(haul|review)\b/i.test(s) || /^\d+(?:\.\d+)?\s?kg\b/i.test(s);
  if (dash && (hasSize || atBoundary) && !postChatter(dash[1])) {
    return { label: cleanLabel(dash[1]), note: dash[2].trim() };
  }
  if (hasSize && atBoundary && !postChatter(line)) return { label: cleanLabel(line), note: "" };
  // "Goyard bag: good quality, the material is thinner…" — the dominant haul
  // review format (2026-07-24 corpus: 15kg GTBuy haul). Name before the colon,
  // review after. The head must look like a product name: short, few words, no
  // sentence punctuation — "For the price its very good: …" is prose, not a
  // header. Stopword lead-ins ("Note:", "Edit:") are out too; cleanLabel
  // already empties w2c/qc/review/link heads.
  const colon = /^(.{3,40}?)\s*[:：]\s+(.+)$/.exec(line);
  if (
    colon &&
    !postChatter(colon[1]) &&
    colon[1].trim().split(/\s+/).length <= 5 &&
    !/[.!?…,]/.test(colon[1]) &&
    !/^(note|ps|p\.s|edit|update|tip|tl;?dr)$/i.test(colon[1].trim())
  ) {
    const label = cleanLabel(colon[1]);
    if (label.length > 2) return { label, note: colon[2].trim() };
  }
  if (
    atBoundary &&
    line.length <= 90 &&
    !postChatter(line)
  ) {
    // A boundary line with sentence punctuation still usually LEADS with the
    // item name ("QC NB 9060 TOP batch, what do you think?") — split at the
    // first sentence break: name before, the rest becomes the note.
    const split = /^(.{3,60}?)[,;!?…]\s*(.+)$/.exec(line);
    if (split) {
      const label = cleanLabel(split[1]);
      if (label.length > 2) return { label, note: split[2].trim() };
      return null;
    }
    if (line.length <= 60 && !/[.!?…,]$/.test(line) && !/,/.test(line)) {
      return { label: cleanLabel(line), note: "" };
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

    const urls = (joined.match(URL_RE) || []).filter(
      (u) => !(agentOf(u) && AGENT_SIGNUP_RE.test(u))
    );
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
    // ("Name (Size M) - review…" on the line above the W2C link). The line
    // directly above the URL is the best candidate; the block's FIRST line
    // covers "name line, then review lines" blocks. Anything before/after the
    // header keeps its old home: previous item's note / this item's note.
    let note = "";
    let fromContext = false;
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
  const noFlair = String(title).replace(/\[(?:qc|find|review|w2c|gp|lc)\]\s*/gi, "");
  // cleanLabel first: it strips a leading "Review:"/"QC" so the chatter guard
  // below only fires on titles that are ABOUT a haul, not tagged as one.
  const cleaned = cleanLabel(noFlair);
  // "15kg haul to EU with GTBuy (Goyard, …)" names a batch, not an item —
  // the same guard headerSplit uses on post-title lines.
  if (/\b(haul|review)\b/i.test(cleaned) || /^\d+(?:\.\d+)?\s?kg\b/i.test(cleaned)) return "";
  const head = /^(.{3,60}?)(?:[,;!?…]|\s+[-–—]\s+|$)/.exec(cleaned);
  const label = head ? head[1].trim() : cleaned;
  return label.length > 2 ? label : "";
}

// Returns null when the paste isn't haul-shaped (caller falls through to the
// generic import path). Otherwise:
//   { items: [{url, label, note, category, rawLine}],
//     stats: {heightCm?, weightKg?, usualSize?, agent?, budget?, budgetCurrency?},
//     poster: string|null, sourceUrl: string|null }
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
  const clean = deobfuscateUrls(trimmed).replace(/\\(?=[_*~])/g, "");

  const items = extractItems(clean);
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
  // outright (the title IS the item name on a QC post); multi-item posts only
  // fill items whose label stayed empty.
  const fromTitle = titleLabel(title);
  if (fromTitle) {
    if (items.length === 1) {
      items[0].label = fromTitle;
      items[0].category = items[0].category || guessCategory(fromTitle);
    } else {
      for (const it of items) {
        if (it.label) continue;
        it.label = fromTitle;
        it.category = it.category || guessCategory(fromTitle);
      }
    }
  }

  return {
    items,
    stats,
    poster: userMatch ? userMatch[1] : null,
    sourceUrl: sourceMatch ? sourceMatch[0] : null,
  };
}
