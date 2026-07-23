import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handler } = require("../netlify/functions/reddit.js");
const SECRET = "test-secret";

const SHARE_LINK = "https://www.reddit.com/r/FashionReps/s/YhWfXlgBrs";
const COMMENTS_URL =
  "https://www.reddit.com/r/FashionReps/comments/1v3fupe/in_hand_review/";

function post(url = SHARE_LINK, secret = SECRET) {
  return {
    httpMethod: "POST",
    headers: { "x-credenza-key": secret },
    body: JSON.stringify({ url }),
  };
}

function listing(selftext) {
  return [
    {
      data: {
        children: [
          {
            data: {
              title: "In-hand review + fit pics",
              selftext,
              author: "haulkyle",
              subreddit: "FashionReps",
              permalink: "/r/FashionReps/comments/1v3fupe/in_hand_review/",
            },
          },
        ],
      },
    },
  ];
}

describe("Reddit function", () => {
  beforeEach(() => {
    process.env.CREDENZA_SEARCH_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.CREDENZA_SEARCH_SECRET;
    vi.restoreAllMocks();
  });

  it("rejects wrong auth and non-reddit URLs", async () => {
    const badAuth = await handler(post(SHARE_LINK, "nope"));
    expect(badAuth.statusCode).toBe(401);
    global.fetch = vi.fn();
    const badHost = await handler(post("https://example.com/r/FashionReps/comments/x"));
    expect(badHost.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("resolves a /s/ share link hop-by-hop and returns the selftext", async () => {
    const calls = [];
    global.fetch = vi.fn(async (url, opts) => {
      calls.push(url);
      if (url.includes("/s/")) {
        return {
          status: 301,
          headers: { get: (h) => (h === "location" ? COMMENTS_URL + "?share_id=xyz" : null) },
        };
      }
      return { status: 200, ok: true, json: async () => listing("Vans Old Skool review text") };
    });
    const res = await handler(post(SHARE_LINK));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.found).toBe(true);
    expect(body.selftext).toBe("Vans Old Skool review text");
    expect(body.author).toBe("haulkyle");
    expect(body.url).toContain("/comments/1v3fupe/");
    // The last call is the .json listing on the resolved comments path.
    expect(calls[calls.length - 1]).toContain("/comments/1v3fupe.json");
  });

  it("refuses to follow a redirect off reddit (SSRF guard)", async () => {
    global.fetch = vi.fn(async () => ({
      status: 301,
      headers: { get: () => "https://evil.example.com/steal" },
    }));
    const res = await handler(post(SHARE_LINK));
    expect(res.statusCode).toBe(502);
  });

  it("reports no-text for link posts so the client can stash the post itself", async () => {
    global.fetch = vi.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => listing(""),
    }));
    const res = await handler(post(COMMENTS_URL));
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.found).toBe(false);
    expect(body.reason).toBe("no-text");
  });

  it("surfaces reddit blocking with an actionable error", async () => {
    global.fetch = vi.fn(async (url) => {
      if (url.includes(".json")) return { status: 403, ok: false };
      return { status: 200, ok: true };
    });
    const res = await handler(post(COMMENTS_URL));
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error).toMatch(/paste the post text/i);
  });

  it("recovers the post id when the chain soft-blocks to the subreddit", async () => {
    // Datacenter behavior: /s/ → comments URL → subreddit homepage. The
    // comments path from the first hop's Location is still the right post.
    global.fetch = vi.fn(async (url) => {
      if (url.includes("/s/")) {
        return {
          status: 301,
          headers: { get: () => COMMENTS_URL },
        };
      }
      if (url.includes("/comments/") && !url.includes(".json")) {
        return {
          status: 301,
          headers: { get: () => "https://www.reddit.com/r/FashionReps/" },
        };
      }
      return { status: 200, ok: true, json: async () => listing("recovered text") };
    });
    const res = await handler(post(SHARE_LINK));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).selftext).toBe("recovered text");
  });

  it("sniffs the post id from a 3xx body when the Location hides it", async () => {
    // Worst-case datacenter chain: /s/ 301s straight to the subreddit, but
    // the short redirect body still carries the real target URL.
    global.fetch = vi.fn(async (url) => {
      if (url.includes("/s/")) {
        return {
          status: 301,
          headers: { get: () => "https://www.reddit.com/r/FashionReps/" },
          text: async () => `<a href="https://www.reddit.com/r/FashionReps/comments/1v3fupe/x/">continue</a>`,
        };
      }
      return { status: 200, ok: true, json: async () => listing("sniffed text") };
    });
    const res = await handler(post(SHARE_LINK));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).selftext).toBe("sniffed text");
  });

  it("refuses to guess when a page holds many different posts", async () => {
    global.fetch = vi.fn(async (url) => {
      if (url.includes("/s/")) {
        return {
          status: 200,
          ok: true,
          headers: { get: () => null },
          text: async () =>
            "/r/FashionReps/comments/aaa111/x /r/FashionReps/comments/bbb222/y /r/FashionReps/comments/ccc333/z",
        };
      }
      return { status: 200, ok: true, json: async () => listing("unused") };
    });
    const res = await handler(post(SHARE_LINK));
    expect(res.statusCode).toBe(400);
  });

  it("uses oauth.reddit.com when app credentials are configured", async () => {
    process.env.REDDIT_CLIENT_ID = "id";
    process.env.REDDIT_CLIENT_SECRET = "secret";
    const calls = [];
    global.fetch = vi.fn(async (url) => {
      calls.push(url);
      if (url.includes("access_token")) {
        return { status: 200, ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) };
      }
      return { status: 200, ok: true, json: async () => listing("OAuth read works") };
    });
    const res = await handler(post(COMMENTS_URL));
    delete process.env.REDDIT_CLIENT_ID;
    delete process.env.REDDIT_CLIENT_SECRET;
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).selftext).toBe("OAuth read works");
    expect(calls.some((u) => u.includes("oauth.reddit.com/r/FashionReps/comments/1v3fupe"))).toBe(true);
  });
});
