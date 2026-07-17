const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function response(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) };
}

exports.handler = async (event) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const searchSecret = process.env.CREDENZA_SEARCH_SECRET;

  if (!apiKey) {
    return response(500, { error: "Server not configured: missing ANTHROPIC_API_KEY" });
  }
  if (!searchSecret) {
    return response(500, { error: "Server not configured: missing CREDENZA_SEARCH_SECRET" });
  }

  const suppliedSecret = event && event.headers && event.headers["x-credenza-key"];
  if (suppliedSecret !== searchSecret) {
    return response(401, { error: "Unauthorized" });
  }
  if (!event || event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  let input;
  try {
    input = JSON.parse(event.body || "");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }
  if (!input || typeof input.query !== "string" || !input.query.trim()) {
    return response(400, { error: "query must be a non-empty string" });
  }
  if (!Array.isArray(input.shelf)) {
    return response(400, { error: "shelf must be an array" });
  }
  if (input.shelf.some((item) => !item || typeof item !== "object" || typeof item.id !== "string")) {
    return response(400, { error: "every shelf item must have a string id" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
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
        system:
          "You search a personal save-it-later shelf. Select only items that answer or meaningfully relate to the user's query. Rank the strongest matches first, use only IDs present in the supplied shelf, and keep every reason and the overall answer concise.",
        messages: [
          {
            role: "user",
            content:
              "Query:\n" +
              input.query.trim() +
              "\n\nCompact shelf:\n" +
              JSON.stringify(input.shelf),
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
  } finally {
    clearTimeout(timer);
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

  const toolUse =
    Array.isArray(modelResponse.content) &&
    modelResponse.content.find(
      (block) => block && block.type === "tool_use" && block.name === "return_credenza_matches"
    );
  const result = toolUse && toolUse.input;
  const validIds = new Set(input.shelf.map((item) => item.id));
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

  return response(200, { results: result.results, answer: result.answer });
};
