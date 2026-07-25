// Step 3 probe: the Stash button replaces the fixed bottom bar, and the ⋯
// masthead button opens the Settings sheet. Runs both themes on iPhone 15 Pro.
import { webkit, devices } from "playwright";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const shelfJson = readFileSync(join(homedir(), "Downloads", "credenza-shelf-2026-07-21.json"), "utf8");
const browser = await webkit.launch();

for (const theme of ["light", "rainbow"]) {
  const ctx = await browser.newContext({ ...devices["iPhone 15 Pro"] });
  await ctx.addInitScript(
    ([j, t]) => {
      window.localStorage.setItem("credenza-fashion-items-v1", j);
      window.localStorage.setItem(
        "credenza-prefs-v1",
        JSON.stringify({ theme: t, colorwayVersion: 4, viewMode: "grid", sortMode: "recent" }),
      );
    },
    [shelfJson, theme],
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
  await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  console.log("=== theme:", theme, "===");
  // QW10 is a clearance rule at the end of the scroll. A fixed button always
  // has a card behind it mid-scroll, so measure where the rule applies.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  console.log(
    "dock",
    JSON.stringify(
      await page.evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const fab = document.querySelector(".cz-stash-fab");
        if (!fab) return { fab: null, oldBar: !!document.querySelector(".cz-bottom-bar") };
        const r = fab.getBoundingClientRect();
        const g = getComputedStyle(fab);
        // Anything the button covers is a card the user cannot reach.
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const under = document
          .elementsFromPoint(cx, cy)
          .map((el) => el.className && typeof el.className === "string" ? el.className.split(" ")[0] : el.tagName)
          .slice(0, 6);
        const overlaps = [...document.querySelectorAll(".cz-editorial-card, .cz-grid-card")].filter((c) => {
          const b = c.getBoundingClientRect();
          return b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom;
        }).length;
        return {
          oldBar: !!document.querySelector(".cz-bottom-bar"),
          size: [+r.width.toFixed(1), +r.height.toFixed(1)],
          right: +(vw - r.right).toFixed(1),
          bottom: +(vh - r.bottom).toFixed(1),
          bg: g.backgroundColor,
          shadow: g.boxShadow,
          badge: !!document.querySelector(".cz-stash-fab-badge"),
          clipPill: !!document.querySelector(".cz-stash-clip"),
          stack: under,
          cardsUnderButton: overlaps,
        };
      }),
      null,
      2,
    ),
  );

  await page.screenshot({ path: `/tmp/step3-shelf-${theme}.png` });

  const settings = page.getByRole("button", { name: "Settings" });
  if (await settings.count()) {
    await settings.first().click({ force: true });
    await page.waitForTimeout(1200);
    console.log(
      "settings",
      JSON.stringify(
        await page.evaluate(() => {
          const el = document.querySelector(".cz-settings");
          if (!el) return "sheet did not render";
          const surface = document.querySelector(".cz-settings-surface");
          return {
            surfaceBg: surface ? getComputedStyle(surface).backgroundColor : null,
            rows: [...el.querySelectorAll(".cz-settings-row")].map((r) => ({
              label: r.querySelector(".cz-settings-row-label").textContent.trim(),
              value: r.querySelector(".cz-settings-row-val").textContent.replace("›", "").trim(),
              h: +r.getBoundingClientRect().height.toFixed(1),
            })),
            foot: el.querySelector(".cz-settings-foot").textContent.trim(),
          };
        }),
        null,
        2,
      ),
    );
    await page.screenshot({ path: `/tmp/step3-settings-${theme}.png` });
  } else console.log("Settings button not found");

  await ctx.close();
}
await browser.close();
