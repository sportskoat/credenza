// Tier A probe (A3 pipeline board + A6 weight + A5 QC attach/GL-RL).
// Seeds a haul with one card per pipeline status, opens it, checks the board
// line, the returned-excluded total, and the rough weight. Then flips the QC
// card and taps GL.
import { chromium } from "playwright";

// 1x1 transparent PNG stands in for a QC photo.
const PIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const items = [
  // QC card first: the carousel opens centered on it, so one tap flips it.
  { id: "q1", status: "ready", title: "QC shoes", project: "casuals", findStatus: "qc", category: "shoes", createdAt: 100, price: 100, currency: "CNY", qcPhotos: [PIX, PIX] },
  { id: "w1", status: "ready", title: "Wanted tee", project: "casuals", findStatus: "want", category: "shirt", createdAt: 90, price: 100, currency: "CNY" },
  { id: "b1", status: "ready", title: "Bought pants", project: "casuals", findStatus: "bought", category: "pants", createdAt: 80, price: 100, currency: "CNY" },
  { id: "g1", status: "ready", title: "GL jacket", project: "casuals", findStatus: "gl", category: "outerwear", createdAt: 70, price: 100, currency: "CNY" },
  { id: "r1", status: "ready", title: "Returned hat", project: "casuals", findStatus: "returned", category: "hat", createdAt: 60, price: 100, currency: "CNY" },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((shelfJson) => {
  window.localStorage.setItem("credenza-fashion-items-v1", shelfJson);
  window.localStorage.setItem(
    "credenza-prefs-v1",
    JSON.stringify({ theme: "light", colorwayVersion: 4, onboardingDone: true, sortMode: "recent" })
  );
}, JSON.stringify(items));
const page = await ctx.newPage();
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

await page.getByRole("tab", { name: /Hauls/i }).click();
await page.waitForTimeout(1000);
await page.getByText("casuals").first().click();
await page.waitForTimeout(1800);

const board = await page.evaluate(() => ({
  stats: document.querySelector(".cz-haul-open-stats")?.textContent?.trim() || null,
  totalRow: document.querySelector(".cz-total-row")?.textContent?.replace(/\s+/g, " ").trim() || null,
}));
console.log("board:", JSON.stringify(board, null, 1));
await page.screenshot({ path: "/tmp/tier-a-haul-head.png", clip: { x: 0, y: 0, width: 1440, height: 260 } });

// A5: the carousel opens on the QC card; one tap flips it.
const qcCard = page.locator(".cz-carousel-card", { hasText: "QC shoes" }).first();
await qcCard.click({ force: true });
await page.waitForTimeout(2000);

const qcSection = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".cz-carousel-card")];
  const card = cards.find((c) => c.textContent.includes("QC shoes"));
  const sec = card && card.querySelector(".cz-qc");
  if (!sec) return { found: false };
  return {
    found: true,
    thumbs: sec.querySelectorAll(".cz-qc-thumb").length,
    head: sec.querySelector(".cz-qc-head")?.textContent?.trim(),
    buttons: [...sec.querySelectorAll(".cz-qc-verdict-btn")].map((b) => b.textContent.trim()),
  };
});
console.log("qc:", JSON.stringify(qcSection));
await page.screenshot({ path: "/tmp/tier-a-qc-section.png" });

// Tap GL → status flips to gl, verdict stamp appears, board updates.
await qcCard.getByRole("button", { name: /GL · ship it/i }).click({ force: true });
await page.waitForTimeout(1200);
const after = await page.evaluate(() => ({
  verdict: document.querySelector(".cz-qc-verdict")?.textContent?.trim() || null,
  board: document.querySelector(".cz-haul-open-stats")?.textContent?.trim() || null,
  stored: JSON.parse(window.localStorage.getItem("credenza-fashion-items-v1")).find((x) => x.id === "q1"),
}));
console.log("after GL:", JSON.stringify({ verdict: after.verdict, board: after.board, status: after.stored?.findStatus, verdictAt: !!after.stored?.qcVerdictAt }));
await page.screenshot({ path: "/tmp/tier-a-after-gl.png" });
await browser.close();
