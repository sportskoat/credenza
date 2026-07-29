// Prove the consent gate in a real browser, not in jsdom.
//
// The claim on the Privacy notice is "no request reaches Google until you
// choose Accept". Only a browser can show that, because the thing being
// measured is a network request the page makes on its own. This probe watches
// every request the page sends and reports any that go to Google.
//
// Run from preview/, with the dev server started in the SAME shell call:
//   (npx vite --port 5348 --strictPort &) ; sleep 8; node scripts/probe-analytics.mjs
import { webkit } from "playwright";

const BASE = process.env.PROBE_BASE || "http://127.0.0.1:5348";
const GOOGLE = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com/;

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log((pass ? "PASS  " : "FAIL  ") + name + (detail ? "  — " + detail : ""));
}

async function openPage(context, path) {
  const page = await context.newPage();
  const googleHits = [];
  page.on("request", (r) => {
    if (GOOGLE.test(r.url())) googleHits.push(r.url());
  });
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  return { page, googleHits };
}

const browser = await webkit.launch();

// 1. A visitor who has not answered: the bar shows and Google sees nothing.
{
  const context = await browser.newContext();
  const { page, googleHits } = await openPage(context, "/guides/choose-an-agent/");
  const bar = await page.locator("#cz-consent-bar").count();
  check("the bar appears on a public page", bar === 1, "found " + bar);
  check("no request to Google before an answer", googleHits.length === 0, googleHits.join(", "));

  const accept = page.locator("#cz-consent-bar button", { hasText: "Accept" });
  await accept.click();
  await page.waitForTimeout(2000);
  check(
    "Accept fetches the tag with Kyle's id",
    googleHits.some((u) => u.includes("id=G-2DQSJN43LF")),
    googleHits.join(", ") || "no request"
  );
  const barAfter = await page.locator("#cz-consent-bar").count();
  check("the bar closes on Accept", barAfter === 0, "found " + barAfter);
  await context.close();
}

// 2. The answer sticks: a second page in the same browser does not ask again.
{
  const context = await browser.newContext();
  const first = await openPage(context, "/faq/");
  await first.page.locator("#cz-consent-bar button", { hasText: "Accept" }).click();
  await first.page.waitForTimeout(500);
  const second = await openPage(context, "/pricing/");
  check("no second question after Accept", (await second.page.locator("#cz-consent-bar").count()) === 0);
  check("counting runs on the next page", second.googleHits.length > 0, String(second.googleHits.length) + " request(s)");
  await context.close();
}

// 3. No thanks: the answer sticks and Google still sees nothing.
{
  const context = await browser.newContext();
  const first = await openPage(context, "/faq/");
  await first.page.locator("#cz-consent-bar button", { hasText: "No thanks" }).click();
  await first.page.waitForTimeout(500);
  const second = await openPage(context, "/how/");
  check("no second question after No thanks", (await second.page.locator("#cz-consent-bar").count()) === 0);
  check("No thanks sends nothing to Google", second.googleHits.length === 0, second.googleHits.join(", "));
  await context.close();
}

// 4. The app shell asks too, and the page still works with the bar on screen.
{
  const context = await browser.newContext();
  const { page, googleHits } = await openPage(context, "/");
  check("the bar appears in the app", (await page.locator("#cz-consent-bar").count()) === 1);
  check("the app sends nothing before an answer", googleHits.length === 0, googleHits.join(", "));
  const shelf = await page.locator(".cz-shell").count();
  check("the app still renders behind the bar", shelf > 0, "cz-shell count " + shelf);
  await context.close();
}

// 5. The Privacy notice can clear the answer.
{
  const context = await browser.newContext();
  const first = await openPage(context, "/privacy/");
  await first.page.locator("#cz-consent-bar button", { hasText: "No thanks" }).click();
  const reopened = await openPage(context, "/privacy/");
  const state = await reopened.page.locator("#cz-consent-state").textContent();
  check("the notice reports the stored answer", /counting is off/.test(state || ""), JSON.stringify(state));
  await reopened.page.locator("#cz-consent-forget").click();
  const third = await openPage(context, "/privacy/");
  check("the bar asks again after Change", (await third.page.locator("#cz-consent-bar").count()) === 1);
  await context.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks pass");
process.exit(failed.length ? 1 : 0);
