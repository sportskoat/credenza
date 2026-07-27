// Verify handoff turn 9 §11 (card → detail photo morph) in a real browser.
//
// The spec: the card's photo grows from its shelf rect into the detail photo
// panel in ~280ms ease-out with no re-crop, the card text fades at 60ms, and the
// info rail wipes in from the photo's inner edge. Shelf cards carry a two-layer
// contact shadow and lift 6px on hover.
//
// Chromium is the only engine here on purpose: it is the one with view
// transitions. Firefox and Safari < 18 take the fallback path, which is the
// entrance animation the app already had, and there is nothing new to look at.
//
// What this probe checks that a jsdom test cannot:
//   1. document.startViewTransition exists and the app calls it.
//   2. ::view-transition pseudo-elements really appear during the open — that
//      is the browser confirming it accepted the shared name. A duplicate name
//      makes it silently skip, and silence looks exactly like success.
//   3. The photo's rect actually travels from the card's box to the panel's.
//   4. Mid-flight frames, so a squashed or re-cropped photo is visible.
//   5. The resting contact shadow and the 6px hover lift.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", ".verify-shots");
mkdirSync(outDir, { recursive: true });

const baseUrl = process.argv[2] || "http://localhost:4173";
const now = Date.now();

// Two items so the shelf is a grid, not a single card — the morph has to pick
// the tapped one and leave the other alone.
function item(i, over = {}) {
  return {
    id: "t9m-" + i,
    createdAt: now - 86400000 * (i + 1),
    updatedAt: now,
    rawText: "https://weidian.com/item.html?itemID=770000" + i,
    url: "https://weidian.com/item.html?itemID=770000" + i,
    type: "article",
    host: "weidian.com",
    title: i === 0 ? "Mutimer Wool Varsity Jacket" : "Second Shelf Tee",
    summary: "Heavy wool body, leather sleeves.",
    tags: [],
    image:
      "https://si.geilicdn.com/pcitem1725553858-6a5e00000191d9d3e1a90a20f3b8-unadjust_640_640.jpg",
    gallery: [],
    links: [],
    price: 249,
    currency: "CNY",
    seller: "Mook-official",
    category: "jacket",
    findStatus: "want",
    weidianUrl: "https://weidian.com/item.html?itemID=770000" + i,
    ...over,
  };
}

const SHELF = [item(0), item(1)];

const basePrefs = {
  // NOTE: viewMode is deliberately NOT restored from prefs (credenza-fashion.jsx
  // ~4159 — every device lands on its own default each session). Desktop starts
  // in the carousel, so the probe clicks "Card view" instead of seeding it.
  viewMode: "cards",
  sortMode: "recent",
  theme: "light",
  colorwayVersion: 4,
  preferredAgent: "superbuy",
  affiliateCodes: {},
  bodyProfile: { usualSize: "L", usualTops: "L", chest: 100, height: 180, weight: 78 },
  measureUnits: "cm",
  onboardingDone: true,
};

const browser = await chromium.launch();

async function newSeededPage(deviceName, prefs = basePrefs) {
  const context = await browser.newContext(
    deviceName ? { ...devices[deviceName] } : { viewport: { width: 1440, height: 900 } }
  );
  await context.addInitScript(
    ({ shelf, prefsJson }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelf);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    },
    { shelf: JSON.stringify(SHELF), prefsJson: JSON.stringify(prefs) }
  );
  // The chart hunt must never fire a real request from a probe.
  await context.route("**/chart-vision", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ found: false }),
    })
  );
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  // §11 is the GRID card → detail transition. Desktop opens in the carousel and
  // the stored viewMode is ignored by design, so switch views here.
  const cardsBtn = page.getByRole("button", { name: "Card view" });
  if (await cardsBtn.count()) {
    await cardsBtn.first().click();
    await page.waitForTimeout(900);
  }
  return { context, page };
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, name + ".png") });
  console.log("shot:", name);
}

// ── 1. Support + the resting card depth ─────────────────────────────────────
{
  const { context, page } = await newSeededPage(null);

  const support = await page.evaluate(
    () => typeof document.startViewTransition === "function"
  );
  console.log("1 startViewTransition available:", support);

  const depth = await page.evaluate(() => {
    const card = document.querySelector(".cz-editorial-card");
    if (!card) return null;
    const cs = getComputedStyle(card);
    const shadow = cs.boxShadow || "";
    return {
      // Two layers means two rgb( groups in the computed value.
      layers: (shadow.match(/rgba?\(/g) || []).length,
      shadow: shadow.slice(0, 120),
      radius: cs.borderRadius,
    };
  });
  console.log("1 resting card depth:", JSON.stringify(depth));

  await shot(page, "t9m-1-shelf-rest");

  // Hover lift: the article translates 6px up.
  const lift = await page.evaluate(async () => {
    const art = document.querySelector("article.cz-editorial-card");
    if (!art) return null;
    const before = art.getBoundingClientRect().top;
    art.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    return { before, transform: getComputedStyle(art).transform };
  });
  console.log("1 hover transform (synthetic):", JSON.stringify(lift));

  // A real cursor is the only way to trigger :hover in Chromium.
  const card = page.locator("article.cz-editorial-card").first();
  await card.hover();
  await page.waitForTimeout(400);
  const hovered = await page.evaluate(() => {
    const art = document.querySelector("article.cz-editorial-card");
    const cs = getComputedStyle(art);
    return { transform: cs.transform, layers: (cs.boxShadow.match(/rgba?\(/g) || []).length };
  });
  console.log("1 hover state:", JSON.stringify(hovered));
  await shot(page, "t9m-2-shelf-hover");

  await context.close();
}

// ── 2. Desktop morph: pseudo-elements, rect travel, mid-flight frames ───────
{
  const { context, page } = await newSeededPage(null);

  // Instrument the transition. We record the card photo's rect before the tap
  // and the panel stage's rect after, plus whether the browser actually built
  // the ::view-transition tree (it drops one into the top layer for the
  // duration — getAnimations() on the document root reports its animations).
  const before = await page.evaluate(() => {
    const el = document.querySelector(".cz-card-toggle");
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log("2 card photo rect:", JSON.stringify(before));

  // Watch for the pseudo-element animations the browser creates. They only
  // exist while a transition runs, and only if it was NOT skipped.
  await page.evaluate(() => {
    window.__morph = { names: [], frames: 0 };
    const originalStart = document.startViewTransition.bind(document);
    document.startViewTransition = (cb) => {
      const t = originalStart(cb);
      t.ready.then(
        () => {
          // Animations on the pseudo-element tree carry the transition names.
          for (const a of document.documentElement.getAnimations({ subtree: true })) {
            const target = a.effect && a.effect.target;
            const pseudo = a.effect && a.effect.pseudoElement;
            if (pseudo) window.__morph.names.push(pseudo);
          }
          window.__morph.ok = true;
        },
        () => {
          window.__morph.ok = false;
          window.__morph.skipped = true;
        }
      );
      return t;
    };
  });

  // Tap the first card and grab frames while the photo is in flight.
  const opener = page.locator(".cz-card-toggle").first();
  await opener.click();
  await page.waitForTimeout(70);
  await shot(page, "t9m-3-midflight-70ms");
  await page.waitForTimeout(70);
  await shot(page, "t9m-4-midflight-140ms");
  await page.waitForTimeout(500);
  await shot(page, "t9m-5-landed");

  const result = await page.evaluate(() => {
    const uniq = Array.from(new Set(window.__morph.names || []));
    const stage = document.querySelector(".cz-dpanel-stage");
    const panel = document.querySelector(".cz-dpanel");
    const rail = document.querySelector(".cz-dpanel-right");
    const r = stage ? stage.getBoundingClientRect() : null;
    return {
      ok: window.__morph.ok,
      skipped: !!window.__morph.skipped,
      pseudos: uniq,
      panelClass: panel ? panel.className : null,
      // The names must be OFF the live nodes once the transition finished —
      // a stuck name would make the NEXT morph a silent no-op.
      stageName: stage ? stage.style.viewTransitionName : null,
      railName: rail ? rail.style.viewTransitionName : null,
      stageRect: r
        ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
        : null,
      // No clone of the shelf card may survive anywhere.
      cardToggles: document.querySelectorAll(".cz-card-toggle").length,
    };
  });
  console.log("2 transition:", JSON.stringify(result, null, 1));
  console.log(
    "2 rect travelled:",
    result.stageRect
      ? JSON.stringify({
          dx: result.stageRect.x - before.x,
          dy: result.stageRect.y - before.y,
          dw: result.stageRect.w - before.w,
          dh: result.stageRect.h - before.h,
        })
      : "no stage"
  );

  await context.close();
}

// ── 3. Phone morph: the sheet must not slide up while the photo flies ───────
{
  const { context, page } = await newSeededPage("iPhone 15 Pro");

  await page.evaluate(() => {
    window.__m = {};
    const orig = document.startViewTransition.bind(document);
    document.startViewTransition = (cb) => {
      const t = orig(cb);
      t.ready.then(
        () => {
          window.__m.ok = true;
          window.__m.pseudos = Array.from(
            new Set(
              document.documentElement
                .getAnimations({ subtree: true })
                .map((a) => a.effect && a.effect.pseudoElement)
                .filter(Boolean)
            )
          );
        },
        () => {
          window.__m.ok = false;
        }
      );
      return t;
    };
  });

  await page.locator(".cz-card-toggle").first().click();
  await page.waitForTimeout(80);
  await shot(page, "t9m-6-phone-midflight");
  await page.waitForTimeout(600);
  await shot(page, "t9m-7-phone-landed");

  const phone = await page.evaluate(() => {
    const surface = document.querySelector(".cz-detail-surface");
    const hero = document.querySelector(".cz-detail-hero");
    return {
      ok: window.__m.ok,
      pseudos: window.__m.pseudos,
      surfaceClass: surface ? surface.className : null,
      // is-morphing must zero the slide-up: no animation-name on the surface.
      surfaceAnim: surface ? getComputedStyle(surface).animationName : null,
      heroName: hero ? getComputedStyle(hero).viewTransitionName : null,
    };
  });
  console.log("3 phone:", JSON.stringify(phone, null, 1));

  await context.close();
}

// ── 4. Reduced motion: no transition at all, entrance intact ────────────────
{
  const context = await browser.newContext({
    ...devices["iPhone 15 Pro"],
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    ({ shelf, prefsJson }) => {
      window.localStorage.setItem("credenza-fashion-items-v1", shelf);
      window.localStorage.setItem("credenza-prefs-v1", prefsJson);
    },
    { shelf: JSON.stringify(SHELF), prefsJson: JSON.stringify(basePrefs) }
  );
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    window.__called = 0;
    const orig = document.startViewTransition.bind(document);
    document.startViewTransition = (cb) => {
      window.__called += 1;
      return orig(cb);
    };
  });
  await page.locator(".cz-card-toggle").first().click();
  await page.waitForTimeout(900);
  const reduced = await page.evaluate(() => ({
    startCalls: window.__called,
    // The detail still opened — the fallback path is the whole point.
    sheetOpen: !!document.querySelector(".cz-detail-surface"),
    morphing: !!document.querySelector(".cz-detail-surface.is-morphing"),
  }));
  console.log("4 reduced motion:", JSON.stringify(reduced));
  await shot(page, "t9m-8-reduced-landed");
  await context.close();
}

await browser.close();
console.log("done");
