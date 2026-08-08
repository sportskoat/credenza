// Diagnostic for Kyle 2026-07-30: weidian item 7739297298 "did not read".
// Server side is proven good (resolve returns 20 descImages, chart-vision
// transcribes the table, parseSizeChart accepts it). This drives the LIVE
// site signed in, pastes the link, opens the card, and records every call.
import { chromium } from "playwright";

const SB = "https://uaweaziqrybvxfbacllb.supabase.co";
const ANON = "sb_publishable_aP1uaOv1BiXdpK88HlsRqw_ClIqaJZV";
const EMAIL = "oom-diagnostic-7739@credenzafashion.com";
const PASS = "Diag-7739-tmp-pass!";
const LINK = "https://weidian.com/item.html?itemID=7739297298";
const OUT = "/Users/kylewensel/.buzz/.scratch";

const sess = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
}).then((r) => r.json());
console.log("session:", !!sess.access_token);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
page.on("response", async (r) => {
  if (!r.url().includes("/.netlify/functions/")) return;
  const name = r.url().split("/functions/")[1];
  let body = "";
  try { body = (await r.text()).slice(0, 260); } catch {}
  console.log("RESP", name, r.status(), body.replace(/\s+/g, " ").slice(0, 200));
});
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE-ERR", m.text().slice(0, 160)); });

await page.goto("https://credenzafashion.com/", { waitUntil: "domcontentloaded" });
await page.evaluate(
  ([s, ref]) => {
    localStorage.setItem(
      `sb-${ref}-auth-token`,
      JSON.stringify({
        access_token: s.access_token,
        refresh_token: s.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + s.expires_in,
        expires_in: s.expires_in,
        token_type: "bearer",
        user: s.user,
      })
    );
  },
  [sess, "uaweaziqrybvxfbacllb"]
);
await page.goto("https://credenzafashion.com/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/diag-02-signedin.png` });

// Dismiss the analytics banner so it cannot swallow a click.
const accept = page.getByRole("button", { name: /No thanks|Accept/ }).first();
if (await accept.count()) { await accept.click(); await page.waitForTimeout(500); }
const box = page.locator("input[placeholder*='Paste' i]").first();
await box.click();
await box.fill(LINK);
await page.getByRole("button", { name: /Stash/i }).first().click();
console.log("STEP pasted link");
await page.waitForTimeout(20000);
await page.screenshot({ path: `${OUT}/diag-03-added.png`, fullPage: false });

// Open the card
const card = page.locator(".cz-card, article").first();
await card.click();
console.log("STEP opened card");
await page.waitForTimeout(30000);
await page.screenshot({ path: `${OUT}/diag-04-detail.png`, fullPage: false });
const txt = await page.evaluate(() => document.body.innerText.slice(0, 2500));
console.log("---- PAGE TEXT ----");
console.log(txt);
await browser.close();
