// Corpus harvest (Kyle, 2026-07-24): browse r/FashionReps like a human and
// save ~20 real post bodies for parser testing. old.reddit.com login-walls
// this network (lor2) and plain fetches to www.reddit.com get 403 — but a
// headless chromium session passes the JS challenge. So: read the listing
// in the browser, then pull each post's raw markdown selftext through the
// same session via its .json endpoint (innerText would lose the URLs).
// Saves to scripts/corpus-fashionreps.json: [{ id, title, selftext }]
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const TARGET = Number(process.argv[2] || 20);
const OUT = new URL("./corpus-fashionreps.json", import.meta.url);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();

await page.goto("https://www.reddit.com/r/FashionReps/hot/", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
await page.waitForSelector("shreddit-post[permalink]", { timeout: 20000 });

// The listing lazy-loads on scroll. Scroll until we have enough posts or
// the feed stops growing.
let lastCount = 0;
for (let i = 0; i < 15; i++) {
  const count = await page.$$eval("shreddit-post[permalink]", (p) => p.length);
  if (count >= TARGET + 8 || count === lastCount) break;
  lastCount = count;
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500); // human pace
}

const permalinks = await page.$$eval("shreddit-post[permalink]", (posts) =>
  posts.map((p) => p.getAttribute("permalink"))
);
console.log("listing gave", permalinks.length, "posts");

const corpus = [];
for (const permalink of permalinks) {
  if (corpus.length >= TARGET) break;
  try {
    // Raw selftext via the post JSON, fetched with the browser's session.
    const data = await page.evaluate(async (path) => {
      const res = await fetch("https://www.reddit.com" + path + ".json?raw_json=1&limit=1", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return { status: res.status };
      return { status: 200, json: await res.json() };
    }, permalink);
    if (data.status !== 200) {
      console.log("skip", permalink.slice(0, 60), "- json", data.status);
      continue;
    }
    const post = data.json?.[0]?.data?.children?.[0]?.data;
    const selftext = post?.selftext || "";
    if (!selftext || !/https?:\/\//.test(selftext)) continue; // need a text post with links
    corpus.push({ id: post.id, title: post.title || "", selftext });
    console.log("got", corpus.length, "-", (post.title || "").slice(0, 60));
    await page.waitForTimeout(800); // human pace
  } catch (e) {
    console.log("skip", permalink.slice(0, 60), "-", String(e).slice(0, 60));
  }
}

await browser.close();
writeFileSync(OUT, JSON.stringify(corpus, null, 2));
console.log("saved", corpus.length, "posts to scripts/corpus-fashionreps.json");
