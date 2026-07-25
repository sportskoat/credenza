// probe-affiliate-pages.mjs — read each agent's affiliate/help page in a real
// browser. WebFetch gets 403 from these hosts (bot filtering), a real browser
// does not. Dumps page text so the referral param + approval rules can be read.
//
// Run: node scripts/probe-affiliate-pages.mjs
//
// Artifacts land OUTSIDE the repo, under ~/.credenza-probe/ (override with
// CREDENZA_PROBE_DIR) so a second lane in this tree never has to gitignore them.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROBE_ROOT = process.env.CREDENZA_PROBE_DIR || join(homedir(), ".credenza-probe");
const OUT = join(PROBE_ROOT, "affiliate-probe") + "/";
mkdirSync(OUT, { recursive: true });

const TARGETS = [
  { agent: "mulebuy", label: "help-affiliate", url: "https://back.mulebuy.com/help-categories/affiliate-rules/" },
  { agent: "mulebuy", label: "register", url: "https://mulebuy.com/register" },
  { agent: "joyagoo", label: "help-affiliate", url: "https://www.joyagoo.com/help-center/affiliate-system-rules" },
  { agent: "joyagoo", label: "register", url: "https://www.joyagoo.com/register" },
  { agent: "hoobuy", label: "home", url: "https://hoobuy.com/" },
  { agent: "hoobuy", label: "register", url: "https://hoobuy.com/register" },
  { agent: "oopbuy", label: "home", url: "https://oopbuy.com/" },
  { agent: "oopbuy", label: "register", url: "https://oopbuy.com/register" },
  { agent: "allchinabuy", label: "home", url: "https://www.allchinabuy.com/en/page/index/" },
  { agent: "allchinabuy", label: "affiliate", url: "https://www.allchinabuy.com/en/page/partner/" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  viewport: { width: 1440, height: 1000 },
  locale: "en-US",
});

const results = [];
for (const t of TARGETS) {
  const page = await ctx.newPage();
  const row = { ...t };
  try {
    const resp = await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    row.status = resp ? resp.status() : null;
    await page.waitForTimeout(6000);
    row.finalUrl = page.url();
    row.title = await page.title();
    const text = await page.evaluate(() => (document.body ? document.body.innerText : ""));
    row.textLen = text.length;
    // Anything that smells like a referral / invite input or link.
    row.signals = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("input,select,textarea").forEach((el) => {
        const n = [el.name, el.id, el.placeholder, el.getAttribute("aria-label")].filter(Boolean).join(" ");
        if (/invit|refer|promo|partner|code|affiliat/i.test(n)) out.push("input: " + n);
      });
      document.querySelectorAll("a[href]").forEach((a) => {
        if (/invit|refer|promo|partner|affiliat|ref=/i.test(a.href)) out.push("link: " + a.href);
      });
      return Array.from(new Set(out)).slice(0, 40);
    });
    writeFileSync(`${OUT}${t.agent}-${t.label}.txt`, `URL: ${row.finalUrl}\nTITLE: ${row.title}\n\n${text}`);
    await page.screenshot({ path: `${OUT}${t.agent}-${t.label}.png` });
  } catch (e) {
    row.error = String(e).slice(0, 200);
  }
  await page.close();
  results.push(row);
  console.log(
    `${t.agent.padEnd(12)} ${t.label.padEnd(16)} http=${row.status ?? "-"} len=${row.textLen ?? "-"} ${row.finalUrl || ""}`
  );
  if (row.signals && row.signals.length) row.signals.forEach((s) => console.log(`    ${s}`));
  if (row.error) console.log(`    ERROR ${row.error}`);
}

await browser.close();
writeFileSync(`${OUT}report.json`, JSON.stringify(results, null, 2));
console.log(`\ntext dumps: ${OUT}`);
