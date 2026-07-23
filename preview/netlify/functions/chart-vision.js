// Size-chart-from-photos for Credenza (fashion build). Sellers on Yupoo almost
// always post the size chart as a PHOTO in the album, not as text — the text
// pipeline (album description / sizeNotes) comes back empty even though the
// chart is right there in the pictures (Kyle, 2026-07-22). Given a set of
// album image URLs, this fetches them server-side (photo.yupoo.com hotlink
// rules make browser fetches flaky), then asks Claude vision to find the size
// chart and transcribe it into the same line format parseSizeChart already
// reads: one line per size, Chinese measure labels preserved ("M 胸围112 衣长70").
// The client drops that text into sizeNotes and the whole deterministic
// chart → recommendation pipeline picks it up unchanged.

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

function response(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) };
}

function safeImageUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
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

// Returns { base64, mediaType } or null.
async function fetchImage(url, referer, signal) {
  try {
    const headers = {
      "user-agent": UA,
      accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
    };
    if (referer) headers.referer = referer;
    const res = await fetch(url, { headers, signal });
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
        "You are looking at photos from a Chinese fashion reseller's album. One or more may be a size chart (尺码表): a table listing garment measurements (胸围 chest, 衣长 length, 肩宽 shoulder, 袖长 sleeve, 腰围 waist, 臀围 hip, 裤长 pants length) for each size. Transcribe ALL measurement columns and ALL size rows exactly as printed — do not convert units, do not invent values, do not round. If several photos each hold part of a chart, combine the rows. If no photo is a size chart, say so.",
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
  return (toolUse && toolUse.input) || null;
}

exports.handler = async (event) => {
  const secret = process.env.CREDENZA_SEARCH_SECRET;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!secret) return response(500, { error: "Server not configured: missing CREDENZA_SEARCH_SECRET" });
  const supplied = event && event.headers && event.headers["x-credenza-key"];
  if (supplied !== secret) return response(401, { error: "Unauthorized" });
  if (!event || event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });
  if (!apiKey) return response(500, { error: "Server not configured: missing ANTHROPIC_API_KEY" });

  let input;
  try {
    input = JSON.parse(event.body || "");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }
  const urls = Array.isArray(input && input.images) ? input.images : [];
  const imageUrls = [...new Set(urls.map(safeImageUrl).filter(Boolean))].slice(0, MAX_IMAGES);
  if (!imageUrls.length) return response(400, { error: "images must contain at least one http(s) URL" });
  const referer = safeReferer(input && input.referer) || fallbackReferer(imageUrls);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const fetched = await Promise.all(imageUrls.map((u) => fetchImage(u, referer, controller.signal)));
    const images = fetched.filter(Boolean);
    if (!images.length) return response(502, { error: "Could not fetch any album photos" });

    const chart = await readChartWithClaude(apiKey, images, controller.signal).catch(() => null);
    if (!chart) return response(502, { error: "Chart read failed" });
    if (!chart.found || !chart.chartText || !chart.chartText.trim()) {
      return response(200, { found: false, chartText: "", scanned: images.length });
    }
    const chartText = chart.chartText.trim() + (chart.note && chart.note.trim() ? "\n" + chart.note.trim() : "");
    return response(200, { found: true, chartText, scanned: images.length });
  } catch (e) {
    if (e && e.name === "AbortError") return response(504, { error: "Timed out" });
    return response(502, { error: "Chart read failed" });
  } finally {
    clearTimeout(timer);
  }
};
