// Size-chart-from-photos for Credenza (fashion build). Sellers on Yupoo almost
// always post the size chart as a PHOTO in the album, not as text — the text
// pipeline (album description / sizeNotes) comes back empty even though the
// chart is right there in the pictures (Kyle, 2026-07-22). Weidian listings do
// the same with geilicdn / alicdn product photos (Kyle, 2026-07-25). Given a
// set of image URLs, this fetches them server-side (CDN hotlink rules make
// browser fetches flaky), then asks Claude vision to find the size chart and
// transcribe it into the same line format parseSizeChart already reads:
// one line per size, Chinese measure labels preserved ("M 胸围112 衣长70").
// The client drops that text into sizeNotes and the whole deterministic
// chart → recommendation pipeline picks it up unchanged.

const { safeFetch } = require("./lib/guard.js");
const limit = require("./lib/limit.js");
const paidGate = require("./lib/paid-gate.js");

const ROUTE = "chart-vision";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
// Same identity as preview.js — the Alibaba CDN behind photo.yupoo.com answers
// 567 text/html to curl-like clients and to requests whose referer is not a
// yupoo album page (verified 2026-07-22).
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 CredenzaPreview/1.0";
const TIMEOUT_MS = 25000;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024; // Claude per-image cap is 5MB
const MODEL = process.env.CREDENZA_RESOLVE_MODEL || "claude-haiku-4-5";
// SSRF lockdown (Part 3): only known marketplace image CDNs, nowhere else.
// Yupoo album photos + Weidian / Ali product images (itemMainPic / gallery).
const ALLOWED_IMAGE_HOST =
  /(^|\.)((photo|pic)\.yupoo\.com|(si|wd|geili)\.geilicdn\.com|geilicdn\.com|(img|gd\d*|gw|g\.alicdn)\.alicdn\.com|alicdn\.com)$/i;

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

// Cheap pre-filter: parse, protocol, and the image-CDN allowlist. The full
// guard (DNS + private-address rejection, checked redirects) runs per fetch
// inside fetchImage.
function safeImageUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!ALLOWED_IMAGE_HOST.test(host)) return null;
  return u.toString();
}

function safeReferer(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  return u.toString();
}

// The CDN only checks that the referer LOOKS like a yupoo album page — any
// *.x.yupoo.com referer passes, even for another seller's photos. When the
// client did not send the album URL, derive one from the image path:
// photo.yupoo.com/<seller>/... → https://<seller>.x.yupoo.com/.
function fallbackReferer(imageUrls) {
  for (const raw of imageUrls) {
    const m = /^https?:\/\/photo\.yupoo\.com\/([\w-]+)\//i.exec(raw);
    if (m) return "https://" + m[1].toLowerCase() + ".x.yupoo.com/";
  }
  return null;
}

// Returns { base64, mediaType } or null. Every hop of every fetch is
// re-validated against the CDN allowlist + private-address rejection.
async function fetchImage(url, referer, signal) {
  try {
    const headers = {
      "user-agent": UA,
      accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
    };
    if (referer) headers.referer = referer;
    const res = await safeFetch(url, { headers, signal, hosts: ALLOWED_IMAGE_HOST, maxRedirects: 3 });
    if (!res.ok) return null;
    const mediaType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mediaType)) return null;
    const buf = await res.arrayBuffer();
    if (!buf || buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    return { base64: Buffer.from(buf).toString("base64"), mediaType };
  } catch {
    return null;
  }
}

const CHART_TOOL = {
  name: "return_size_chart",
  description: "Return the size chart transcribed from the photos, or report that none is present.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["found", "chartText"],
    properties: {
      found: {
        type: "boolean",
        description: "True if any photo contains a garment size chart (a table of measurements per size).",
      },
      chartText: {
        type: "string",
        description:
          "One line per size row: the size token, then each measurement as its ORIGINAL label (keep Chinese labels like 胸围/衣长/肩宽/袖长/腰围/臀围/裤长) followed by the number in cm. Example line: 'M 胸围112 衣长70 肩宽48 袖长62'. Empty string when found is false.",
      },
      note: {
        type: "string",
        description: "Short note if the chart says it runs big/small (偏大/偏小) or anything else relevant. Empty string otherwise.",
      },
    },
  },
};

async function readChartWithClaude(apiKey, images, signal) {
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
      max_tokens: 2000,
      system:
        "You are looking at photos from a Chinese fashion reseller's album. One or more may be a size chart (尺码表): a table listing garment measurements (胸围 chest, 衣长 length, 肩宽 shoulder, 袖长 sleeve, 腰围 waist, 臀围 hip, 裤长 pants length) for each size. Transcribe ALL measurement columns and ALL size rows exactly as printed — do not convert units, do not invent values, do not round. If the chart labels chest as 半胸, 1/2 chest, half chest, or pit-to-pit, keep that half-chest label (write 半胸) with the printed number — do not double it. If several photos each hold part of a chart, combine the rows. If no photo is a size chart, say so.",
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image",
              source: { type: "base64", media_type: img.mediaType, data: img.base64 },
            })),
            { type: "text", text: "Find the size chart in these photos and transcribe it." },
          ],
        },
      ],
      tools: [CHART_TOOL],
      tool_choice: { type: "tool", name: "return_size_chart" },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const toolUse =
    data &&
    Array.isArray(data.content) &&
    data.content.find((b) => b && b.type === "tool_use" && b.name === "return_size_chart");
  if (!toolUse || !toolUse.input) return null;
  return { result: toolUse.input, usage: data && data.usage };
}

async function handle(event) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!event || event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });
  if (!apiKey) return response(500, { error: "Server not configured: missing ANTHROPIC_API_KEY" });
  // Part 7f: account (Bearer + per-plan daily cap) or, until REQUIRE_ACCOUNTS
  // flips, the anonymous shared key.
  const gate = await paidGate.authorizePaid(event, process.env, "chartVision");
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
  const urls = Array.isArray(input && input.images) ? input.images : [];
  const imageUrls = [...new Set(urls.map(safeImageUrl).filter(Boolean))].slice(0, MAX_IMAGES);
  if (!imageUrls.length) {
    return response(400, { error: "images must contain at least one allowed CDN image URL" });
  }
  const referer = safeReferer(input && input.referer) || fallbackReferer(imageUrls);

  const blocked = limit.enter(ROUTE, limit.clientKey(event));
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const fetched = await Promise.all(imageUrls.map((u) => fetchImage(u, referer, controller.signal)));
    const images = fetched.filter(Boolean);
    if (!images.length) return response(502, { error: "Could not fetch any album photos" });

    const chart = await readChartWithClaude(apiKey, images, controller.signal).catch(() => null);
    if (!chart) return response(502, { error: "Chart read failed" });
    limit.recordUsage(ROUTE, MODEL, chart.usage);
    await paidGate.recordPaidUsage(gate, "chartVision");
    const result = chart.result;
    if (!result.found || !result.chartText || !result.chartText.trim()) {
      return response(200, { found: false, chartText: "", scanned: images.length });
    }
    const chartText =
      result.chartText.trim() + (result.note && result.note.trim() ? "\n" + result.note.trim() : "");
    return response(200, { found: true, chartText, scanned: images.length });
  } catch (e) {
    if (e && e.name === "AbortError") return response(504, { error: "Timed out" });
    return response(502, { error: "Chart read failed" });
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
