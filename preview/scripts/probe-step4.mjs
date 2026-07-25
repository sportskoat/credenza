// Step 4 probe: the Stash sheet is one flow with one primary button, and a
// stash raises the action toast with an Undo. Runs both themes on iPhone 15 Pro.
//
// jsdom cannot measure anything, so the numbers the handoff sets (58px button,
// 16px paste type, 44px touch targets) are only checkable here.
import { webkit, devices } from "playwright";

const HAUL = [
  "https://weidian.com/item.html?itemID=7649592219",
  "https://shop1850859027.v.weidian.com/item.html?itemID=7808837642",
  "https://item.taobao.com/item.htm?id=812345678901",
  "https://x.yupoo.com/albums/98765432",
].join("\n");

const browser = await webkit.launch();

for (const theme of ["light", "rainbow"]) {
  const ctx = await browser.newContext({ ...devices["iPhone 15 Pro"] });
  // WebKit refuses a silent clipboard read, so the sheet always opens in state
  // B here. Stub the reader to prove state A renders and stashes as well.
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: async () => "https://weidian.com/item.html?itemID=7649592219" },
    });
    // The app probes the permission before it reads, and WebKit rejects the
    // "clipboard-read" name outright. Grant it so state A is reachable here.
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: async () => ({ state: "granted" }) },
    });
  });
  await ctx.addInitScript(
    (t) => {
      window.localStorage.setItem("credenza-fashion-items-v1", "[]");
      window.localStorage.setItem(
        "credenza-prefs-v1",
        JSON.stringify({ theme: t, colorwayVersion: 4, viewMode: "grid", sortMode: "recent" }),
      );
    },
    theme,
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  console.log("=== theme:", theme, "===");

  const intro = page.getByRole("button", { name: "Get started" });
  if (await intro.count()) await intro.first().click({ force: true });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Stash a link or note" }).first().click({ force: true });
  await page.waitForTimeout(900);

  // The sheet opens in one of two states. Report which, and report that the
  // removed controls are gone in both.
  console.log(
    "sheet",
    JSON.stringify(
      await page.evaluate(() => {
        const px = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
        const box = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return [+r.width.toFixed(1), +r.height.toFixed(1)];
        };
        const paste = document.querySelector(".cz-stash-paste");
        const primary = document.querySelector(".cz-stash-primary");
        const alt = document.querySelector(".cz-stash-alt");
        const surface = document.querySelector(".cz-stash-surface");
        return {
          state: paste ? "B empty" : "A detected",
          removed: {
            sources: !!document.querySelector(".cz-stash-sources"),
            links: !!document.querySelector(".cz-capture-sheet-links"),
            clipChip: !!document.querySelector(".cz-capture-clip"),
          },
          // In state A the parse result belongs to the clipboard card, under a
          // hairline. Anywhere else and it reads as a separate claim.
          readyInCard: (() => {
            const r = document.querySelector(".cz-stash-ready");
            if (!r) return null;
            return { inCard: !!r.closest(".cz-stash-clipcard"), divider: getComputedStyle(r).borderTopWidth };
          })(),
          surfaceBg: px(surface, "backgroundColor"),
          surfaceRadius: px(surface, "borderTopLeftRadius"),
          pasteFontPx: px(paste, "fontSize"),
          pasteBox: box(paste),
          primaryLabel: primary ? primary.textContent.trim() : null,
          primaryBox: box(primary),
          primaryBg: px(primary, "backgroundColor"),
          primaryColor: px(primary, "color"),
          altBox: box(alt),
          foot: (document.querySelector(".cz-stash-foot") || {}).textContent,
        };
      }),
      null,
      2,
    ),
  );
  await page.screenshot({ path: `/tmp/step4-sheet-open-${theme}.png` });

  // "Stash something else instead" drops state A for state B. The paste box is
  // the only way to reach state C, so the probe takes that route.
  const alt = page.locator(".cz-stash-alt");
  if (await alt.count()) {
    await alt.click({ force: true });
    await page.waitForTimeout(500);
    console.log(
      "afterAlt",
      JSON.stringify(await page.evaluate(() => ({
        clipcard: !!document.querySelector(".cz-stash-clipcard"),
        paste: !!document.querySelector(".cz-stash-paste"),
        focused: document.activeElement ? document.activeElement.className : null,
      }))),
    );
  }

  // State C: a four-link haul. The list caps at three rows plus a "+ N more".
  const paste = page.locator(".cz-stash-paste");
  if (await paste.count()) {
    await paste.fill(HAUL);
    await page.waitForTimeout(600);
    console.log(
      "multi",
      JSON.stringify(
        await page.evaluate(() => ({
          primaryLabel: (document.querySelector(".cz-stash-primary") || {}).textContent,
          ready: (document.querySelector(".cz-stash-ready-text") || {}).textContent,
          rows: [...document.querySelectorAll(".cz-stash-row")].map((r) => ({
            title: r.querySelector(".cz-stash-row-title").textContent,
            code: r.querySelector(".cz-stash-row-code").textContent,
            h: +r.getBoundingClientRect().height.toFixed(1),
          })),
          more: (document.querySelector(".cz-stash-list-more") || {}).textContent || null,
        })),
        null,
        2,
      ),
    );
    await page.screenshot({ path: `/tmp/step4-sheet-multi-${theme}.png` });

    // One link, then stash it. The sheet must close and the toast must appear
    // above the Stash button, not under the stats row.
    await paste.fill("https://weidian.com/item.html?itemID=7649592219");
    await page.waitForTimeout(500);
    await page.locator(".cz-stash-primary").click({ force: true });
    await page.waitForTimeout(1000);
    console.log(
      "toast",
      JSON.stringify(
        await page.evaluate(() => {
          const vh = window.innerHeight;
          const toast = document.querySelector('.cz-toast[data-tone="action"]');
          if (!toast) return { toast: null, sheetStillOpen: !!document.querySelector(".cz-stash-body") };
          const r = toast.getBoundingClientRect();
          const g = getComputedStyle(toast);
          const fab = document.querySelector(".cz-stash-fab");
          const undo = toast.querySelector(".cz-toast-action");
          return {
            sheetStillOpen: !!document.querySelector(".cz-stash-body"),
            message: (toast.querySelector(".cz-toast-message") || {}).textContent,
            undoLabel: undo ? undo.textContent.trim() : null,
            undoBox: undo ? [+undo.getBoundingClientRect().width.toFixed(1), +undo.getBoundingClientRect().height.toFixed(1)] : null,
            bg: g.backgroundColor,
            color: g.color,
            bottomGap: +(vh - r.bottom).toFixed(1),
            clearsFab: fab ? +(fab.getBoundingClientRect().top - r.bottom).toFixed(1) : null,
          };
        }),
        null,
        2,
      ),
    );
    await page.screenshot({ path: `/tmp/step4-toast-${theme}.png` });

    // The Undo takes the card back off the shelf.
    const undo = page.getByRole("button", { name: "Undo" });
    if (await undo.count()) {
      await undo.first().click({ force: true });
      await page.waitForTimeout(700);
      console.log(
        "undo",
        JSON.stringify(
          await page.evaluate(() => ({
            stored: JSON.parse(window.localStorage.getItem("credenza-fashion-items-v1") || "[]").length,
            cards: document.querySelectorAll(".cz-grid-card, .cz-editorial-card").length,
          })),
        ),
      );
    } else console.log("undo button not found");
  } else console.log("no paste box — sheet opened in state A");

  await ctx.close();
}
await browser.close();
