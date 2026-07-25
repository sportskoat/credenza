// Buy-link resolver for Credenza (fashion build). Given a Weidian item URL,
// fetches the item's public SKU API server-side (the product page itself is an
// empty JS shell), then asks Claude to translate the Chinese title and variant
// names into English, categorize the garment, and summarize sizing. Returns
// structured JSON the client can drop straight onto a card. No dependencies.

const limit = require("./lib/limit.js");
const paidGate = require("./lib/paid-gate.js");

const ROUTE = "resolve";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const WEIDIAN_API = "https://thor.weidian.com/detail/getItemSkuInfo/1.0";
const FX_API = "https://open.er-api.com/v6/latest/CNY";
const FX_FALLBACK_USD_PER_CNY = 0.14;
const TIMEOUT_MS = 20000;
const MAX_VARIANT_VALUES = 60;
const MODEL = process.env.CREDENZA_RESOLVE_MODEL || "claude-haiku-4-5";

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

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

async function fetchWeidianItem(itemId, signal) {
  const param = encodeURIComponent(JSON.stringify({ itemId }));
  const res = await fetch(`${WEIDIAN_API}?param=${param}`, {
    headers: {
      "user-agent": UA,
      referer: `https://weidian.com/item.html?itemID=${itemId}`,
      accept: "application/json",
    },
    signal,
  });
  if (!res.ok) throw { status: 502, msg: `Weidian request failed (${res.status})` };
  const data = await res.json();
  if (!data || !data.status || data.status.code !== 0 || !data.result) {
    throw { status: 404, msg: "Weidian item not found" };
  }
  return data.result;
}

// Flattens the Weidian result into the facts we care about. Prices arrive in
// fen (1/100 CNY). attrList groups carry the variant axes (often size/color);
// per-value images are the closest thing to a gallery the API exposes.
function extractFacts(result) {
  const attrGroups = (result.attrList || []).map((group) => ({
    title: group.attrTitle || "",
    values: (group.attrValues || [])
      .slice(0, MAX_VARIANT_VALUES)
      .map((v) => ({ name: String(v.attrValue || ""), img: v.img || null })),
  }));
  const images = [];
  if (result.itemMainPic) images.push(result.itemMainPic);
  for (const group of attrGroups) {
    for (const v of group.values) {
      if (v.img && !images.includes(v.img)) images.push(v.img);
    }
  }
  const low = result.itemDiscountLowPrice;
  const high = result.itemDiscountHighPrice;
  return {
    itemId: String(result.itemId || ""),
    title: result.itemTitle || "",
    mainImage: result.itemMainPic || null,
    images: images.slice(0, 10),
    priceCny: typeof low === "number" ? low / 100 : null,
    priceCnyHigh: typeof high === "number" && high !== low ? high / 100 : null,
    stock: typeof result.itemStock === "number" ? result.itemStock : null,
    attrGroups,
  };
}

async function fetchUsdRate(signal) {
  try {
    const res = await fetch(FX_API, { signal });
    if (!res.ok) return FX_FALLBACK_USD_PER_CNY;
    const data = await res.json();
    const rate = data && data.rates && data.rates.USD;
    return typeof rate === "number" && rate > 0 && rate < 1 ? rate : FX_FALLBACK_USD_PER_CNY;
  } catch {
    return FX_FALLBACK_USD_PER_CNY;
  }
}

const ENRICH_TOOL = {
  name: "return_item_details",
  description: "Return the translated, categorized product details.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["titleEn", "summary", "category", "variantGroups"],
    properties: {
      titleEn: {
        type: "string",
        description: "Natural English product title. If the original is a bare SKU code, describe the product from the variant names instead.",
      },
      summary: {
        type: "string",
        description: "One crisp sentence describing what this item is and anything notable (material, style, batch).",
      },
      category: {
        type: "string",
        enum: ["shirt", "pants", "shoes", "outerwear", "accessory", "bag", "hat", "other"],
      },
      sizeNotes: {
        type: "string",
        description: "Short note on the size run if the variants are garment sizes (e.g. 'Runs S–XXL in CN sizing — CN sizes run about one size small vs US'). Empty string if variants aren't sizes.",
      },
      variantGroups: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "values"],
          properties: {
            title: { type: "string", description: "English name of the variant axis (e.g. Size, Color, Model)" },
            values: { type: "array", items: { type: "string" }, description: "English names, same order as supplied" },
          },
        },
      },
    },
  },
};

async function enrichWithClaude(apiKey, facts, signal) {
  const compact = {
    title: facts.title,
    priceCny: facts.priceCny,
    variantGroups: facts.attrGroups.map((g) => ({
      title: g.title,
      values: g.values.map((v) => v.name),
    })),
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system:
        "You translate Chinese marketplace (Weidian) fashion listings into concise English for a personal shopping shelf. Translate faithfully, keep brand and model names recognizable, and categorize the garment. Variant values must be returned in the same order they were given.",
      messages: [
        {
          role: "user",
          content: "Listing data:\n" + JSON.stringify(compact),
        },
      ],
      tools: [ENRICH_TOOL],
      tool_choice: { type: "tool", name: "return_item_details" },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const toolUse =
    data &&
    Array.isArray(data.content) &&
    data.content.find((b) => b && b.type === "tool_use" && b.name === "return_item_details");
  if (!toolUse || !toolUse.input) return null;
  return { result: toolUse.input, usage: data && data.usage };
}

async function handle(event) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!event || event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });
  // Part 7f: account (Bearer + per-plan daily cap) or, until REQUIRE_ACCOUNTS
  // flips, the anonymous shared key.
  const gate = await paidGate.authorizePaid(event, process.env, "resolve");
  if (!gate.ok) {
    return response(gate.status, gate.body, gate.retryAfter ? { "retry-after": String(gate.retryAfter) } : undefined);
  }
  if (limit.bodyTooLarge(event, ROUTE)) return response(413, { error: "Body too large" });

  let input;
  try {
    input = JSON.parse(event.body || "");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }
  const url = input && typeof input.url === "string" ? input.url.trim() : "";
  if (!url || url.length > 2048) return response(400, { error: "url must be a non-empty string" });

  const itemId = weidianItemId(url);
  if (!itemId) return response(422, { error: "Not a resolvable buy link" });

  const blocked = limit.enter(ROUTE, limit.clientKey(event));
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const [result, usdPerCny] = await Promise.all([
      fetchWeidianItem(itemId, controller.signal),
      fetchUsdRate(controller.signal),
    ]);
    const facts = extractFacts(result);

    // Translation is an enhancement: the raw facts already make a usable card,
    // so a Claude failure degrades to untranslated output instead of erroring.
    let enriched = null;
    if (apiKey) {
      const out = await enrichWithClaude(apiKey, facts, controller.signal).catch(() => null);
      if (out) {
        enriched = out.result;
        limit.recordUsage(ROUTE, MODEL, out.usage);
      }
    }

    const variantGroups = facts.attrGroups.map((group, gi) => ({
      title:
        (enriched && enriched.variantGroups && enriched.variantGroups[gi] && enriched.variantGroups[gi].title) ||
        group.title,
      values: group.values.map((v, vi) => ({
        name:
          (enriched &&
            enriched.variantGroups &&
            enriched.variantGroups[gi] &&
            Array.isArray(enriched.variantGroups[gi].values) &&
            enriched.variantGroups[gi].values[vi]) ||
          v.name,
        img: v.img,
      })),
    }));

    await paidGate.recordPaidUsage(gate, "resolve");
    return response(200, {
      source: "weidian",
      itemId: facts.itemId,
      url: `https://weidian.com/item.html?itemID=${facts.itemId}`,
      title: (enriched && enriched.titleEn) || facts.title,
      originalTitle: facts.title,
      summary: (enriched && enriched.summary) || "",
      category: (enriched && enriched.category) || "other",
      sizeNotes: (enriched && enriched.sizeNotes) || "",
      priceCny: facts.priceCny,
      priceCnyHigh: facts.priceCnyHigh,
      priceUsd: facts.priceCny != null ? Math.round(facts.priceCny * usdPerCny * 100) / 100 : null,
      usdPerCny,
      stock: facts.stock,
      mainImage: facts.mainImage,
      images: facts.images,
      variantGroups,
      translated: !!enriched,
    });
  } catch (e) {
    if (e && e.name === "AbortError") return response(504, { error: "Timed out" });
    if (e && e.status) return response(e.status, { error: e.msg });
    return response(502, { error: "Resolve failed" });
  } finally {
    clearTimeout(timer);
    limit.leave(ROUTE);
  }
}

// Outcome log for every request — status + latency only, never content.
exports.handler = async (event) => {
  const started = Date.now();
  let res;
  try {
    res = await handle(event);
  } catch {
    res = response(500, { error: "Internal error" });
  }
  limit.logOutcome(ROUTE, limit.clientKey(event), res.statusCode, { ms: Date.now() - started });
  return res;
};
