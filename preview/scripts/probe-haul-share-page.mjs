// Visual check for the v2 shared haul page (haul sharing handoff 2026-08).
// Renders a rich six-item v2 document through the real share-page renderer,
// then screenshots it at 390px and 1120px in dark and light, clicks the
// Receipt tab, and proves prefers-reduced-motion stops the cover marquee.
// Run: node scripts/probe-haul-share-page.mjs
import { webkit } from "playwright";
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";
import { createServer } from "node:http";

const require = createRequire(import.meta.url);
const sharePage = require("../netlify/functions/share-page.js");
const { pageHtml } = sharePage._internal;

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass });
  console.log((pass ? "PASS  " : "FAIL  ") + name + " — " + detail);
};

// A solid-colour 8x8 PNG as a data URI. safeSrc allows base64 raster images.
function pngDataUri(r, g, b) {
  const raw = [];
  for (let y = 0; y < 8; y++) {
    raw.push(0);
    for (let x = 0; x < 8; x++) raw.push(r, g, b);
  }
  const idat = deflateSync(Buffer.from(raw));
  const chunks = [];
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
    let crc = 0xffffffff;
    for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, body, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  chunks.push(chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)));
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...chunks]);
  return "data:image/png;base64," + png.toString("base64");
}

const COLOURS = [
  [196, 84, 72],
  [74, 103, 156],
  [92, 138, 94],
  [190, 152, 74],
  [128, 92, 150],
  [72, 140, 140],
];

const TITLES = ["Arc Shorts", "Mertra T-shirt", "Fox 94 zip hoodie", "Nylon cap", "Court sneakers", "Wool overshirt"];
const items = TITLES.map((title, i) => ({
  title,
  image: pngDataUri(...COLOURS[i]),
  photos: [pngDataUri(...COLOURS[i]), pngDataUri(...COLOURS[(i + 2) % 6])],
  size: i % 2 ? "XL" : "L",
  platform: "weidian",
  storeUrl: "https://weidian.com/item.html?itemID=105000972378" + i,
  buyUrl: "https://www.superbuy.com/en/page/buy?url=encoded&partnercode=201444039",
  priceUsd: 13.99 + i * 4,
  seller: "shop" + i,
  weightGrams: 200 + i * 25,
  fabric: i === 1 ? "midweight" : undefined,
  fit: {
    translation: i % 2 ? "Their XL fits like a US M." : "Their L fits like a US 30–31 waist.",
    short: i % 2 ? "XL = US M" : "L = US 30–31",
    roomLine: "14cm of room on my 98cm. Regular fit.",
    advice: "Around a 98cm chest? Take the XL.",
    source: "Read from the seller's chart",
  },
  note: i === 0 ? "Heavy fleece, YKK zip." : undefined,
  rebuy: i === 0 ? true : i === 1 ? false : undefined,
  rating: i === 0 ? 9 : i === 1 ? 7 : i === 2 ? 5 : undefined,
  run: i === 0 ? "small" : undefined,
}));

const doc = {
  v: 2,
  title: "casuals",
  count: items.length,
  truncated: false,
  layout: "both",
  includes: { prices: true, w2c: true, fit: true, sellers: true, qc: false, weights: true },
  intro: "Six pieces through Superbuy. Sizes are read against my own measurements: 98cm chest, 79cm waist, 178cm.",
  agent: "Superbuy",
  orderedAt: "2026-06-23T00:00:00.000Z",
  receivedAt: "2026-07-12T00:00:00.000Z",
  goodsUsd: 99.1,
  shipUsd: 39.3,
  shipLine: "EMS",
  landedUsd: 138.4,
  chargeableG: 2753,
  items,
  createdAt: 1754000000000,
};

const html = pageHtml(doc);

// Serve the page over real http: the tab script writes ?v=receipt with
// history.replaceState, which about:blank refuses.
const server = createServer((req, res) => {
  if (req.url.startsWith("/s/probecode")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = "http://127.0.0.1:" + server.address().port;

const browser = await webkit.launch();
const shots = ".verify-shots";

async function shoot(name, width, height, colorScheme, extra = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme,
    deviceScaleFactor: 2,
    ...extra,
  });
  const page = await context.newPage();
  await page.goto(baseUrl + "/s/probecode", { waitUntil: "load" });
  await page.waitForTimeout(300);
  return { context, page, name };
}

// 1-4: the four viewport/colourway shots of the review view.
for (const [name, w, h, scheme] of [
  ["haul-share-mobile-dark", 390, 844, "dark"],
  ["haul-share-mobile-light", 390, 844, "light"],
  ["haul-share-desktop-dark", 1120, 900, "dark"],
  ["haul-share-desktop-light", 1120, 900, "light"],
]) {
  const { context, page } = await shoot(name, w, h, scheme);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  record(name + " no horizontal overflow", overflow <= 1, "overflow=" + overflow + "px");
  await page.screenshot({ path: shots + "/" + name + ".png", fullPage: true });
  await context.close();
}

// 5: the plate overlaps the cover band on mobile.
{
  const { context, page } = await shoot("plate", 390, 844, "dark");
  const boxes = await page.evaluate(() => {
    const band = document.querySelector(".cz-band, .cz-cover, [class*=marquee]")?.getBoundingClientRect();
    const plate = document.querySelector(".cz-plate, [class*=plate]")?.getBoundingClientRect();
    return { band: band && { top: band.top, bottom: band.bottom }, plate: plate && { top: plate.top } };
  });
  if (boxes.band && boxes.plate) {
    record(
      "masthead plate overlaps the band",
      boxes.plate.top < boxes.band.bottom && boxes.plate.top > boxes.band.top,
      "band " + boxes.band.top + ".." + boxes.band.bottom + ", plate top " + boxes.plate.top
    );
  } else {
    record("masthead plate overlaps the band", false, "could not find band or plate: " + JSON.stringify(boxes));
  }
  await context.close();
}

// 6: the marquee track is duplicated and animates; reduced motion stops it.
{
  const { context, page } = await shoot("marquee", 390, 844, "dark");
  const anim = await page.evaluate(() => {
    const track = document.querySelector(".cz-marquee");
    if (!track) return null;
    const cs = getComputedStyle(track);
    return { name: cs.animationName, tiles: track.children.length };
  });
  record(
    "marquee animates with duplicated tiles",
    !!anim && anim.name !== "none" && anim.tiles >= 12,
    JSON.stringify(anim)
  );
  await context.close();
}
{
  const { context, page } = await shoot("marquee-still", 390, 844, "dark", { reducedMotion: "reduce" });
  const anim = await page.evaluate(() => {
    const track = document.querySelector(".cz-marquee");
    return track ? getComputedStyle(track).animationName : null;
  });
  record("prefers-reduced-motion stops the marquee", anim === "none", "animationName=" + anim);
  await context.close();
}

// 7: the Receipt tab swaps the body and writes ?v=receipt without a reload.
// Mobile and desktop each render a tab set; only one is visible per width.
{
  const { context, page } = await shoot("receipt", 390, 844, "dark");
  await page.locator('button[data-view="receipt"]:visible').first().click();
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => ({
    url: location.search,
    receiptVisible: !!document.querySelector(".cz-view-receipt") &&
      getComputedStyle(document.querySelector(".cz-view-receipt")).display !== "none",
    reviewHidden: !!document.querySelector(".cz-view-review") &&
      getComputedStyle(document.querySelector(".cz-view-review")).display === "none",
  }));
  record("receipt tab swaps the body", state.receiptVisible && state.reviewHidden, JSON.stringify(state));
  record("receipt tab writes ?v=receipt", state.url.includes("v=receipt"), "search=" + state.url);
  await page.screenshot({ path: shots + "/haul-share-mobile-receipt.png", fullPage: true });
  await context.close();
}

// 8: desktop receipt shot.
{
  const { context, page } = await shoot("receipt-desk", 1120, 900, "light");
  await page.locator('button[data-view="receipt"]:visible').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: shots + "/haul-share-desktop-receipt.png", fullPage: true });
  await context.close();
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log("\n" + (results.length - failed.length) + "/" + results.length + " checks passed");
if (failed.length) process.exit(1);
