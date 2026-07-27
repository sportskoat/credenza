const limit = require("./lib/limit.js");
const paidGate = require("./lib/paid-gate.js");

const ROUTE = "ask";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

// Mirror of the client-side serializeAskCandidates bounds — the function must
// hold the line even if a modified client sends more.
//
// LB-56. This list is an allowlist: anything absent is dropped silently, which
// is right for an unknown field and wrong for a known one. It had drifted. The
// client sent seller, batch, size, colorway, agentLink, findSource, findStatus,
// ageDays and importance, and this function threw all nine away before the
// model saw them — so "which items are waiting on QC" and "what did I buy from
// that seller" were unanswerable by construction. test/ask-shelf-fields.test.js
// asserts the two lists match, so the next field added cannot drift out again.
const MAX_SHELF_ITEMS = 25;
const MAX_QUERY_CHARS = 1000;
const FIELD_LIMITS = {
  id: 80,
  title: 160,
  summary: 360,
  note: 500,
  extractedIntent: 240,
  project: 120,
  useCase: 240,
  host: 160,
  type: 40,
  url: 500,
  seller: 80,
  batch: 80,
  size: 40,
  colorway: 80,
  agentLink: 240,
  findSource: 240,
  findStatus: 40,
  importance: 40,
};
// Numbers, not strings, so the clamp above does not apply. Each is bounded by
// its own rule below: a shelf age no larger than a plausible lifetime, and a
// price rounded to cents. A hostile client cannot make either one long.
const NUMBER_FIELDS = { ageDays: 400000, priceUsd: 1000000 };
const LIST_LIMITS = { tags: 8, people: 8 };
const LIST_ITEM_MAX = 60;

function response(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: { ...JSON_HEADERS, ...(extraHeaders || {}) },
    body: JSON.stringify(payload),
  };
}

async function handle(event) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return response(500, { error: "Server not configured: missing ANTHROPIC_API_KEY" });
  }
  if (!event || event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  // Part 7f: account (Bearer + per-plan daily cap) or, until REQUIRE_ACCOUNTS
  // flips, the anonymous shared key.
  const gate = await paidGate.authorizePaid(event, process.env, "ask");
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
  if (!input || typeof input.query !== "string" || !input.query.trim()) {
    return response(400, { error: "query must be a non-empty string" });
  }
  if (input.query.trim().length > MAX_QUERY_CHARS) {
    return response(400, { error: `query may be at most ${MAX_QUERY_CHARS} characters` });
  }
  if (!Array.isArray(input.shelf)) {
    return response(400, { error: "shelf must be an array" });
  }
  if (input.shelf.length > MAX_SHELF_ITEMS) {
    return response(400, { error: `shelf may contain at most ${MAX_SHELF_ITEMS} items` });
  }
  if (input.shelf.some((item) => !item || typeof item !== "object" || typeof item.id !== "string")) {
    return response(400, { error: "every shelf item must have a string id" });
  }

  const blocked = limit.enter(ROUTE, limit.clientKey(event));
  if (blocked) {
    return response(blocked.status, { error: blocked.msg }, { "retry-after": String(blocked.retryAfter) });
  }

  const clamp = (value, max) => (typeof value === "string" ? value.slice(0, max) : undefined);
  const shelf = input.shelf.map((item) => {
    const compact = {};
    for (const [field, max] of Object.entries(FIELD_LIMITS)) {
      const value = clamp(item[field], max);
      if (value) compact[field] = value;
    }
    for (const [field, max] of Object.entries(LIST_LIMITS)) {
      if (Array.isArray(item[field])) {
        const list = item[field]
          .filter((entry) => typeof entry === "string" && entry)
          .slice(0, max)
          .map((entry) => entry.slice(0, LIST_ITEM_MAX));
        if (list.length) compact[field] = list;
      }
    }
    // The string clamp above returns undefined for a number, so these two need
    // their own pass. A price of "40" as a string is also accepted, because the
    // model only ever compares it to another number.
    for (const [field, max] of Object.entries(NUMBER_FIELDS)) {
      const value = Number(item[field]);
      if (item[field] == null || !Number.isFinite(value)) continue;
      compact[field] = Math.min(Math.max(value, 0), max);
    }
    compact.id = item.id.slice(0, FIELD_LIMITS.id);
    return compact;
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    let anthropicResponse;
    try {
      anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 1200,
          // LB-56. The shelf now carries status, price and age, and a code like
          // "gl" means nothing without a key. The two questions /how/ advertises
          // — "what is still in Want under $40" and "which items are waiting on
          // QC" — are both filters over these fields, so the field vocabulary
          // has to be part of the prompt, not left for the model to guess.
          system:
            "You search a personal save-it-later shelf for clothing finds. Select only items that answer or meaningfully relate to the user's query. Rank the strongest matches first, use only IDs present in the supplied shelf, and keep every reason and the overall answer concise.\n\n" +
            "Field key. findStatus is the buying stage: want (not bought yet), bought (paid, at the agent's warehouse), shipped (parcel sent), qc (waiting on quality-check photos), gl (QC approved, green light), rl (QC rejected, red light), returned. priceUsd is US dollars, converted where the listing was in another currency, and is absent when no price is known. ageDays is days since the card was saved. importance is low, medium or high. seller, batch, size and colorway are the user's own notes.\n\n" +
            "Treat a question about price, status or age as a filter over those fields. Answer it exactly: if the user asks what is still in Want under $40, return only items with findStatus want and priceUsd below 40. If a needed field is absent on an item, say so rather than guessing.",
          messages: [
            {
              role: "user",
              content:
                "Query:\n" +
                input.query.trim() +
                "\n\nCompact shelf:\n" +
                JSON.stringify(shelf),
            },
          ],
          tools: [
            {
              name: "return_credenza_matches",
              description: "Return ranked shelf matches and a short answer to the query.",
              input_schema: {
                type: "object",
                additionalProperties: false,
                required: ["results", "answer"],
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["id", "why"],
                      properties: {
                        id: { type: "string" },
                        why: { type: "string" },
                      },
                    },
                  },
                  answer: { type: "string" },
                },
              },
            },
          ],
          tool_choice: { type: "tool", name: "return_credenza_matches" },
        }),
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        return response(504, { error: "Anthropic request timed out" });
      }
      return response(502, { error: "Could not reach Anthropic" });
    }

    if (anthropicResponse.status === 401) {
      return response(401, { error: "Anthropic rejected the configured API key" });
    }
    if (anthropicResponse.status === 429) {
      return response(429, { error: "Anthropic rate limit reached; try again shortly" });
    }
    if (!anthropicResponse.ok) {
      return response(502, { error: `Anthropic request failed (${anthropicResponse.status})` });
    }

    let modelResponse;
    try {
      modelResponse = await anthropicResponse.json();
    } catch {
      return response(502, { error: "Anthropic returned malformed JSON" });
    }
    limit.recordUsage(ROUTE, "claude-sonnet-5", modelResponse && modelResponse.usage);

    const toolUse =
      Array.isArray(modelResponse.content) &&
      modelResponse.content.find(
        (block) => block && block.type === "tool_use" && block.name === "return_credenza_matches"
      );
    const result = toolUse && toolUse.input;
    const validIds = new Set(shelf.map((item) => item.id));
    const valid =
      result &&
      typeof result.answer === "string" &&
      Array.isArray(result.results) &&
      result.results.every(
        (item) =>
          item &&
          typeof item.id === "string" &&
          validIds.has(item.id) &&
          typeof item.why === "string"
      );
    if (!valid) {
      return response(502, { error: "Anthropic returned an invalid structured response" });
    }

    await paidGate.recordPaidUsage(gate, "ask");
    return response(200, { results: result.results, answer: result.answer });
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
