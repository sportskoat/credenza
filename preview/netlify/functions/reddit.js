// Reddit post → text for Credenza (fashion build). Kyle's flow (2026-07-22):
// he shares a FashionReps post to the clipboard (often a reddit.com/r/.../s/...
// share link) and expects one card per item, not one card for the post. The
// browser can't read reddit's JSON endpoints reliably (CORS + bot walls), so
// this function resolves the post server-side and returns its selftext. The
// CLIENT runs parseRedditHaul on the text — all attribution logic stays in one
// tested place.
//
// POST { url } → { found, title, selftext, author, subreddit, url }
// Share links (/s/) and redd.it short links are resolved manually hop by hop;
// every hop must stay on reddit (no open-redirect SSRF).

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 15000;
const MAX_HOPS = 4;

function response(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) };
}

function redditHost(hostname) {
  const h = (hostname || "").toLowerCase();
  return /(^|\.)(reddit\.com|redd\.it)$/.test(h);
}

// Resolve redirects one hop at a time; refuse to leave reddit. Datacenter IPs
// often get an extra soft-redirect from the comments URL to the subreddit
// homepage ("you're blocked" behavior), so remember every comments path seen
// in a Location header along the way — the last one is the post we wanted.
// Returns { finalUrl, res, discoveredPath } or null when a hop leaves reddit.
async function resolveRedditUrl(startUrl, signal) {
  let current = startUrl;
  let discoveredPath = null;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    let u;
    try {
      u = new URL(current);
    } catch {
      return null;
    }
    if (!redditHost(u.hostname)) return null;
    const selfPath = commentsPath(u.toString());
    if (selfPath) discoveredPath = selfPath;
    const res = await fetch(u.toString(), {
      redirect: "manual",
      headers: { "user-agent": UA, accept: "text/html,application/json" },
      signal,
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      const next = new URL(loc, u).toString();
      const hopPath = redditHost(new URL(next).hostname) ? commentsPath(next) : null;
      if (hopPath) discoveredPath = hopPath;
      current = next;
      continue;
    }
    return { finalUrl: u.toString(), res, discoveredPath };
  }
  return null;
}

// Pull the /r/<sub>/comments/<id> path out of any resolved reddit post URL.
function commentsPath(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const m = /^\/r\/[\w-]+\/comments\/[a-z0-9]+/i.exec(u.pathname);
  return m ? m[0] : null;
}

// Reddit's anonymous JSON endpoints 403 from datacenter IPs (2026-07). The
// sanctioned path is a "script" app + client_credentials on oauth.reddit.com
// (Kyle creates the app at reddit.com/prefs/apps — one minute, no redirect
// URI needed). Token cached at module scope across warm invocations.
let tokenCache = { token: null, expiresAt: 0 };

async function redditToken(signal) {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": UA,
    },
    body: "grant_type=client_credentials",
    signal,
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || !data.access_token) return null;
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.min((data.expires_in || 3600) - 120, 3300) * 1000,
  };
  return tokenCache.token;
}

// Fetch the post listing JSON. OAuth first when configured; anonymous .json
// as a fallback (it answers from some IPs). Returns the post data object,
// or { error } describing the failure for the client toast.
async function fetchPostListing(path, signal) {
  const token = await redditToken(signal).catch(() => null);
  if (token) {
    const res = await fetch("https://oauth.reddit.com" + path + "?raw_json=1&limit=1", {
      headers: { authorization: "Bearer " + token, "user-agent": UA },
      signal,
    });
    if (res.ok) return { data: await res.json().catch(() => null) };
    if (res.status === 404) return { error: "That post doesn't exist (or is private)" };
    // Fall through to the anonymous attempt on other OAuth failures.
  }
  const res = await fetch("https://www.reddit.com" + path + ".json?raw_json=1&limit=1", {
    headers: { "user-agent": UA, accept: "application/json" },
    signal,
  });
  if (res.ok) return { data: await res.json().catch(() => null) };
  if (res.status === 429 || res.status === 403) {
    return { error: "Reddit blocked the read — paste the post text here instead" };
  }
  return { error: "Reddit did not answer" };
}

exports.handler = async (event) => {
  const secret = process.env.CREDENZA_SEARCH_SECRET;
  if (!secret) return response(500, { error: "Server not configured: missing CREDENZA_SEARCH_SECRET" });
  const supplied = event && event.headers && event.headers["x-credenza-key"];
  if (supplied !== secret) return response(401, { error: "Unauthorized" });
  if (!event || event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });

  let input;
  try {
    input = JSON.parse(event.body || "");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }
  const url = input && typeof input.url === "string" ? input.url.trim() : "";
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return response(400, { error: "url must be a valid URL" });
  }
  if (!redditHost(parsed.hostname)) return response(400, { error: "Only reddit post URLs" });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Share links (/s/, redd.it) 301 to the canonical comments URL.
    const resolved = await resolveRedditUrl(parsed.toString(), controller.signal);
    if (!resolved) return response(502, { error: "Could not resolve that Reddit link" });
    // A soft-blocked chain ends on the subreddit homepage; the comments path
    // we saw in an earlier hop's Location is still the post Kyle asked for.
    const path = commentsPath(resolved.finalUrl) || resolved.discoveredPath;
    if (!path) return response(400, { error: "That link is not a Reddit post" });

    const { data, error } = await fetchPostListing(path, controller.signal);
    if (error) return response(502, { error });
    const post =
      Array.isArray(data) && data[0] && data[0].data && Array.isArray(data[0].data.children)
        ? data[0].data.children[0] && data[0].data.children[0].data
        : null;
    if (!post) return response(502, { error: "Could not read that post" });

    const selftext = typeof post.selftext === "string" ? post.selftext : "";
    const permalink = "https://www.reddit.com" + (post.permalink || path + "/");
    if (!selftext.trim()) {
      // Link/image posts carry no item text; the client stashes the post itself.
      return response(200, {
        found: false,
        reason: "no-text",
        title: String(post.title || ""),
        author: String(post.author || ""),
        subreddit: String(post.subreddit || ""),
        url: permalink,
      });
    }
    return response(200, {
      found: true,
      title: String(post.title || ""),
      selftext,
      author: String(post.author || ""),
      subreddit: String(post.subreddit || ""),
      url: permalink,
    });
  } catch (e) {
    if (e && e.name === "AbortError") return response(504, { error: "Reddit timed out" });
    return response(502, { error: "Could not reach Reddit" });
  } finally {
    clearTimeout(timer);
  }
};
