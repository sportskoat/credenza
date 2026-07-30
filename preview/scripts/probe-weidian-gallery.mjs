// Live proof for Kyle's report 2026-07-29: a Weidian listing that shows five
// photos arrived as two. Fetches both live feeds for one item, then runs the
// real resolve.js helpers over the answer and prints the gallery it builds.
//
// Usage: node scripts/probe-weidian-gallery.mjs [itemId]
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { _test } = require("../netlify/functions/resolve.js");
const { descImageUrls, galleryWithDescPhotos, isChartShaped } = _test;

const itemId = process.argv[2] || "7744643744";
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const headers = {
  "user-agent": UA,
  referer: `https://weidian.com/item.html?itemID=${itemId}`,
  accept: "application/json",
};

async function feed(url, param) {
  const res = await fetch(`${url}?param=${encodeURIComponent(JSON.stringify(param))}`, { headers });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

const sku = await feed("https://thor.weidian.com/detail/getItemSkuInfo/1.0", { itemId });
const desc = await feed("https://thor.weidian.com/detail/getDetailDesc/1.0", { vItemId: itemId });

const result = sku.result || {};
const before = [];
if (result.itemMainPic) before.push(result.itemMainPic);
for (const group of result.attrList || []) {
  for (const value of group.attrValues || []) {
    if (value.img && !before.includes(value.img)) before.push(value.img);
  }
}

const descContent = ((desc.result || {}).item_detail || {}).desc_content;
const descImages = descImageUrls(descContent).filter((u) => !before.includes(u));
const after = galleryWithDescPhotos(before, descImages);

console.log(`item ${itemId} — ${result.itemTitle || "(no title)"}`);
console.log(`gallery before: ${before.length}`);
console.log(`gallery after:  ${after.length}`);
console.log(`desc photos:    ${descImages.length}`);
for (const url of descImages) {
  console.log(`  ${isChartShaped(url) ? "table " : "photo "} ${url}`);
}
const charts = descImages.filter(isChartShaped);
console.log(`tables held out of the gallery: ${charts.length}`);
console.log(charts.every((u) => !after.includes(u)) ? "PASS no table in the gallery" : "FAIL table in the gallery");
