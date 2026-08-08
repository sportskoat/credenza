// Kyle 2026-07-30: after a reload the app showed a signed-out blank card.
// This signs in through the REAL UI on the live site, reloads, and reports
// whether the session survives. Then it pastes the Weidian link and watches
// whether the link reader and the chart reader run.
import { chromium } from "playwright";

const EMAIL = "oom-signin-check@credenzafashion.com";
const PASS = "Diag-Signin-tmp-1!";
const LINK = "https://weidian.com/item.html?itemID=7739297298";
const OUT = "/Users/kylewensel/.buzz/.scratch";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
page.on("response", async (r) => {
  if (!r.url().includes("/.netlify/functions/")) return;
  const name = r.url().split("/functions/")[1].split("?")[0];
  let body = "";
  try { body = (await r.text()).slice(0, 160); } catch {}
  console.log("FN", name, r.status(), body.replace(/\s+/g, " ").slice(0, 120));
});

await page.goto("https://credenzafashion.com/", { waitUntil: "networkidle" });
const banner = page.getByRole("button", { name: /No thanks|Accept/ }).first();
if (await banner.count()) { await banner.click(); await page.waitForTimeout(400); }

// Open the account menu and sign in.
await page.locator("header button").last().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/sp-01-account.png` });
await page.getByText("Sign in", { exact: false }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/sp-01b-signin-form.png` });
const emailBox = page.locator("input[type='email']").first();
await emailBox.waitFor({ timeout: 15000 });
await emailBox.fill(EMAIL);
await page.locator("input[type='password']").first().fill(PASS);
await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/sp-02-after-signin.png` });
const afterSignin = await page.evaluate(() =>
  Object.keys(localStorage).filter((k) => /auth|sb-|credenza-plan/i.test(k))
);
console.log("STORAGE after sign-in:", afterSignin);

// The question: does the session survive a reload?
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(4000);
const afterReload = await page.evaluate(() =>
  Object.keys(localStorage).filter((k) => /auth|sb-|credenza-plan/i.test(k))
);
console.log("STORAGE after reload:", afterReload);
await page.screenshot({ path: `${OUT}/sp-03-after-reload.png` });
await browser.close();
