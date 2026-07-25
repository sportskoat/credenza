// verify-agent-links.mjs — open each agent template against REAL marketplace
// items in a real browser and report what actually renders.
//
// curl status checks lie: agents are SPAs behind bot checks. A 200 means the
// shell loaded, not that the product page resolved. This script waits for the
// network to settle, then looks for product signals (price, add-to-cart, title)
// versus failure signals (404 text, "not found", login wall, redirect to home).
//
// Run: node scripts/verify-agent-links.mjs
//
// Artifacts (screenshots, page dumps, browser profiles) are written OUTSIDE the
// repo, under ~/.credenza-probe/. They are throwaway debris — tens of megabytes
// of Chrome profile — and a second lane working in this tree should never have
// to gitignore them. Override the root with CREDENZA_PROBE_DIR.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildAgentUrl, AGENTS } from "../../agents.js";

const PROBE_ROOT = process.env.CREDENZA_PROBE_DIR || join(homedir(), ".credenza-probe");
const SHOT_DIR = join(PROBE_ROOT, "agent-verify-shots") + "/";
mkdirSync(SHOT_DIR, { recursive: true });

// Real items pulled from Kyle's own fashion-items-import.json (live Weidian
// listings) plus a known-live Taobao item for platform-token coverage.
const ITEMS = [
  { label: "weidian-7800400500", url: "https://weidian.com/item.html?itemID=7800400500" },
  { label: "taobao-song", url: "https://item.taobao.com/item.htm?id=680761597181" },
];

const AGENT_IDS = ["mulebuy", "joyagoo", "cnfans", "hoobuy", "oopbuy", "allchinabuy"];

// Signals that the product page really resolved.
const GOOD = [
  /add to cart/i, /加入购物车/, /立即购买/, /buy now/i, /加入购物袋/,
  /add to basket/i, /submit order/i, /product details/i, /商品详情/,
];
// Signals of a hard failure.
const BAD = [
  /404/, /not found/i, /page does not exist/i, /页面不存在/,
  /item does not exist/i, /商品不存在/, /invalid (product|item)/i,
  /出错了/, /something went wrong/i, /error occurred/i,
];
// Signals of a login/verification wall (link shape may still be correct).
const WALL = [
  /sign in/i, /log ?in to continue/i, /请登录/, /verify you are human/i,
  /cloudflare/i, /just a moment/i, /captcha/i, /security check/i,
];

function classify(text, finalUrl, builtUrl) {
  const hits = (list) => list.filter((re) => re.test(text)).map(String);
  const bad = hits(BAD);
  const good = hits(GOOD);
  const wall = hits(WALL);

  // Redirect back to a bare homepage = the deep link was not honoured.
  let bounced = false;
  try {
    const f = new URL(finalUrl);
    const b = new URL(builtUrl);
    bounced = f.host === b.host && f.pathname.replace(/\/$/, "") === "" && b.pathname.replace(/\/$/, "") !== "";
  } catch (e) { /* ignore */ }

  let verdict;
  if (bad.length && !good.length) verdict = "FAIL";
  else if (bounced) verdict = "BOUNCED";
  else if (good.length) verdict = "RENDERS";
  else if (wall.length) verdict = "WALL";
  else verdict = "UNCLEAR";

  return { verdict, good, bad, wall, bounced };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
  locale: "en-US",
});

const report = [];

for (const agentId of AGENT_IDS) {
  for (const item of ITEMS) {
    const built = buildAgentUrl(agentId, item.url);
    const row = {
      agent: agentId,
      item: item.label,
      wrapped: built.wrapped,
      reason: built.reason || null,
      builtUrl: built.url,
    };
    if (!built.wrapped) {
      row.verdict = "NOT-WRAPPED";
      report.push(row);
      continue;
    }
    const page = await ctx.newPage();
    try {
      const resp = await page.goto(built.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      row.status = resp ? resp.status() : null;
      // SPAs need time to hydrate; networkidle often never fires on these sites.
      await page.waitForTimeout(8000);
      row.finalUrl = page.url();
      row.title = await page.title();
      const text = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 20000) : "");
      row.textLen = text.length;
      Object.assign(row, classify(text, row.finalUrl, built.url));
      row.sample = text.replace(/\s+/g, " ").slice(0, 300);
      const shot = `${SHOT_DIR}${agentId}-${item.label}.png`;
      await page.screenshot({ path: shot, fullPage: false });
      row.screenshot = shot;
    } catch (e) {
      row.verdict = "ERROR";
      row.error = String(e).slice(0, 200);
    }
    await page.close();
    report.push(row);
  }
}

await browser.close();

writeFileSync(`${SHOT_DIR}report.json`, JSON.stringify(report, null, 2));

// Terse table for the human.
for (const r of report) {
  console.log(
    [
      r.agent.padEnd(12),
      r.item.padEnd(20),
      String(r.verdict).padEnd(12),
      `http=${r.status ?? "-"}`,
      `len=${r.textLen ?? "-"}`,
      r.finalUrl || r.builtUrl,
    ].join(" | ")
  );
  if (r.sample) console.log(`    ${r.sample.slice(0, 160)}`);
}
console.log(`\nreport: ${SHOT_DIR}report.json`);
