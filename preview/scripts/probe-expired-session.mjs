// Expired-session UX probe against the LIVE site (the account card only
// renders when AUTH_ENABLED, which is true in the production bundle).
// Seed a session whose access token is already expired and whose refresh
// token is bogus. Expected: the app tries one refresh, fails, signs the
// device out, and the account card falls back to the signed-out state —
// no crash, no spinner forever, no phantom Pro badge.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const SHOTS = new URL("./ui-audit/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

// A JWT-shaped expired token (payload: sub/email/exp in the past). The app
// decodes claims without verifying — the server re-verifies every call.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fakeJwt = `${b64({ alg: "ES256", typ: "JWT" })}.${b64({
  sub: "00000000-0000-0000-0000-000000000000",
  email: "probe@example.com",
  exp: Math.floor(Date.now() / 1000) - 3600,
})}.fakesig`;

await ctx.addInitScript((jwt) => {
  localStorage.setItem(
    "credenza-fashion-session-v1",
    JSON.stringify({
      accessToken: jwt,
      refreshToken: "bogus-refresh-token",
      expiresAt: Date.now() - 60 * 1000, // expired one minute ago
      user: { id: "00000000-0000-0000-0000-000000000000", email: "probe@example.com" },
    })
  );
  localStorage.setItem("credenza-prefs-v1", JSON.stringify({ onboardingDone: true }));
}, fakeJwt);

const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
page.on("console", (m) => {
  if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 150));
});

await page.goto("https://credenzafashion.com/", { waitUntil: "networkidle" });
await page.waitForTimeout(4000); // boot: getValidSession → refresh attempt → sign-out
await page.screenshot({ path: `${SHOTS}x-01-expired-boot.png` });

const sessionAfter = await page.evaluate(() => localStorage.getItem("credenza-fashion-session-v1"));
console.log("session key after boot (want null):", sessionAfter === null ? "null" : sessionAfter.slice(0, 60));

await page.getByRole("button", { name: "Profile" }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${SHOTS}x-02-expired-profile.png` });

const card = await page.evaluate(() => {
  const el = document.querySelector(".cz-profile-signin, [class*='profile']");
  return el ? el.textContent.replace(/\s+/g, " ").slice(0, 200) : "(no profile sheet text)";
});
console.log("profile sheet text:", card);

const scrollLocked = await page.evaluate(() => getComputedStyle(document.body).overflow === "hidden");
console.log("scroll locked while sheet open (expected true):", scrollLocked);

await browser.close();
console.log("done");
