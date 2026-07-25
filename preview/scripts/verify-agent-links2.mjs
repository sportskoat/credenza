// verify-agent-links2.mjs — headed browser, candidate-route discovery.
//
// Round 1 (headless) hit Cloudflare "security verification" on mulebuy,
// joyagoo and allchinabuy, and showed joyagoo's /en/page/buy route dumping to
// the homepage. So this round does two things differently:
//   1. Runs HEADED with a persistent profile — headless is what trips the walls.
//   2. Tests SEVERAL candidate routes per agent, not just the one in agents.js,
//      so we learn the real format instead of only grading my guess.
//
// Verdicts: RENDERS (product signals present) > WALL (bot/login gate) >
// BOUNCED (dumped to homepage — route not honoured) > FAIL > UNCLEAR.
//
// Run: node scripts/verify-agent-links2.mjs
//
// Artifacts — including the ~78 MB persistent Chrome profile — land OUTSIDE the
// repo, under ~/.credenza-probe/ (override with CREDENZA_PROBE_DIR). Never write
// a browser profile into the working tree; a second lane will sweep it into a
// commit.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROBE_ROOT = process.env.CREDENZA_PROBE_DIR || join(homedir(), ".credenza-probe");
const OUT = join(PROBE_ROOT, "agent-verify2") + "/";
mkdirSync(OUT, { recursive: true });
const PROFILE = join(PROBE_ROOT, "agent-verify-profile");

const WEIDIAN = "https://weidian.com/item.html?itemID=7800400500";
const WEIDIAN_ID = "7800400500";
const TAOBAO = "https://item.taobao.com/item.htm?id=680761597181";
const TAOBAO_ID = "680761597181";
const enc = encodeURIComponent;

// Candidate routes. `current` marks the template that agents.js ships today.
const CANDIDATES = [
  // ── Mulebuy ────────────────────────────────────────────────────────────────
  { agent: "mulebuy", market: "weidian", current: true,  url: `https://mulebuy.com/product/?id=${WEIDIAN_ID}&shop_type=weidian` },
  { agent: "mulebuy", market: "weidian", url: `https://mulebuy.com/product?id=${WEIDIAN_ID}&shop_type=weidian` },
  { agent: "mulebuy", market: "weidian", url: `https://mulebuy.com/product/?platform=WEIDIAN&id=${WEIDIAN_ID}` },
  { agent: "mulebuy", market: "taobao",  current: true,  url: `https://mulebuy.com/product/?id=${TAOBAO_ID}&shop_type=taobao` },
  { agent: "mulebuy", market: "taobao",  url: `https://mulebuy.com/product/?platform=TAOBAO&id=${TAOBAO_ID}` },

  // ── Joyagoo ── round 1 showed /en/page/buy dumps to the homepage ───────────
  { agent: "joyagoo", market: "weidian", current: true,  url: `https://www.joyagoo.com/en/page/buy?url=${enc(WEIDIAN)}` },
  { agent: "joyagoo", market: "weidian", url: `https://joyagoo.com/product/?id=${WEIDIAN_ID}&shop_type=weidian` },
  { agent: "joyagoo", market: "weidian", url: `https://joyagoo.com/product/?platform=WEIDIAN&id=${WEIDIAN_ID}` },
  { agent: "joyagoo", market: "weidian", url: `https://joyagoo.com/product/2/${WEIDIAN_ID}` },
  { agent: "joyagoo", market: "taobao",  url: `https://joyagoo.com/product/?id=${TAOBAO_ID}&shop_type=taobao` },
  { agent: "joyagoo", market: "taobao",  url: `https://joyagoo.com/product/?platform=TAOBAO&id=${TAOBAO_ID}` },

  // ── CNFans ── round 1: weidian bounced to home, taobao thin ────────────────
  { agent: "cnfans", market: "weidian", current: true,  url: `https://cnfans.com/product/?platform=WEIDIAN&id=${WEIDIAN_ID}` },
  { agent: "cnfans", market: "weidian", url: `https://cnfans.com/product/?shop_type=weidian&id=${WEIDIAN_ID}` },
  { agent: "cnfans", market: "taobao",  current: true,  url: `https://cnfans.com/product/?platform=TAOBAO&id=${TAOBAO_ID}` },

  // ── Hoobuy ── round 1: weidian RENDERED. Confirm + taobao behind login ─────
  { agent: "hoobuy", market: "weidian", current: true,  url: `https://hoobuy.com/product/2/${WEIDIAN_ID}` },
  { agent: "hoobuy", market: "taobao",  current: true,  url: `https://hoobuy.com/product/1/${TAOBAO_ID}` },

  // ── Oopbuy ── round 1: thin shell, unclear ────────────────────────────────
  { agent: "oopbuy", market: "weidian", current: true,  url: `https://oopbuy.com/product/2/${WEIDIAN_ID}` },
  { agent: "oopbuy", market: "weidian", url: `https://www.oopbuy.com/product/2/${WEIDIAN_ID}` },
  { agent: "oopbuy", market: "taobao",  current: true,  url: `https://oopbuy.com/product/1/${TAOBAO_ID}` },

  // ── AllChinaBuy ── Superbuy sister; both slash variants ───────────────────
  { agent: "allchinabuy", market: "weidian", current: true, url: `https://www.allchinabuy.com/en/page/buy/?url=${enc(WEIDIAN)}` },
  { agent: "allchinabuy", market: "weidian", url: `https://www.allchinabuy.com/en/page/buy?url=${enc(WEIDIAN)}` },
  { agent: "allchinabuy", market: "taobao",  current: true, url: `https://www.allchinabuy.com/en/page/buy/?url=${enc(TAOBAO)}` },
];

const GOOD = [/add to cart/i, /加入购物车/, /立即购买/, /buy now/i, /submit order/i, /商品详情/, /product details/i, /select (size|color|specification)/i, /QC Photos/i, /Purchase Record/i, /avg\.? ship/i];
const BAD = [/404/, /not found/i, /page does not exist/i, /页面不存在/, /商品不存在/, /item does not exist/i];
const WALL = [/security verification/i, /verify you are human/i, /just a moment/i, /captcha/i, /malicious bots/i, /welcome back[\s\S]{0,40}log in/i];

function classify(text, finalUrl, builtUrl) {
  const hit = (l) => l.some((re) => re.test(text));
  let bounced = false;
  try {
    const f = new URL(finalUrl), b = new URL(builtUrl);
    const fp = f.pathname.replace(/\/+$/, ""), bp = b.pathname.replace(/\/+$/, "");
    // Same site (ignore www), landed on "/" while we asked for a deep path/query.
    const sameSite = f.host.replace(/^www\./, "") === b.host.replace(/^www\./, "");
    bounced = sameSite && fp === "" && (bp !== "" || b.search !== "") && !f.search;
  } catch (e) { /* ignore */ }
  if (hit(WALL)) return bounced ? "WALL" : "WALL";
  if (hit(BAD)) return "FAIL";
  if (bounced) return "BOUNCED";
  if (hit(GOOD)) return "RENDERS";
  return "UNCLEAR";
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1360, height: 940 },
  locale: "en-US",
  timezoneId: "America/Phoenix",
  args: ["--disable-blink-features=AutomationControlled"],
});

const rows = [];
for (const c of CANDIDATES) {
  const page = await ctx.newPage();
  const row = { ...c };
  try {
    const resp = await page.goto(c.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    row.status = resp ? resp.status() : null;
    // Cloudflare interstitials clear themselves in a few seconds; SPAs hydrate slowly.
    await page.waitForTimeout(12000);
    row.finalUrl = page.url();
    row.title = await page.title();
    const text = await page.evaluate(() => (document.body ? document.body.innerText.slice(0, 20000) : ""));
    row.textLen = text.length;
    row.verdict = classify(text, row.finalUrl, c.url);
    row.sample = text.replace(/\s+/g, " ").slice(0, 240);
    const name = `${c.agent}-${c.market}-${rows.length}`;
    await page.screenshot({ path: `${OUT}${name}.png` });
    writeFileSync(`${OUT}${name}.txt`, `REQ: ${c.url}\nFINAL: ${row.finalUrl}\n\n${text}`);
    row.shot = `${OUT}${name}.png`;
  } catch (e) {
    row.verdict = "ERROR";
    row.error = String(e).slice(0, 160);
  }
  await page.close();
  rows.push(row);
  console.log(`${c.agent.padEnd(12)} ${c.market.padEnd(8)} ${c.current ? "CURRENT" : "alt    "} ${String(row.verdict).padEnd(9)} http=${row.status ?? "-"} len=${String(row.textLen ?? "-").padEnd(6)} ${row.finalUrl || ""}`);
  if (row.sample) console.log(`    ${row.sample.slice(0, 150)}`);
}

await ctx.close();
writeFileSync(`${OUT}report.json`, JSON.stringify(rows, null, 2));
console.log(`\nreport: ${OUT}report.json`);
