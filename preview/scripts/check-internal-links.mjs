// Internal link check for the public site.
//
// Kyle, 2026-07-27: "please make sure everything can be linked/looks good."
//
// Walks every index.html under preview/public, collects every internal
// href that starts with "/", and confirms a real file sits behind it.
// Prints a table of addresses with an inbound-link count, then PASS or
// FAIL. Exits 1 on any dead address, so it can gate a commit.
//
// WHY THIS EXISTS AND NOT A curl LOOP (LB-65): curl reports HTTP 200 for
// an address that has no page, because the dev server answers any
// unmatched path with the app. A status code is not proof. This script
// checks the file on disk instead, which cannot lie.
//
// Run:  node scripts/check-internal-links.mjs
// It needs no server. It reads the repo only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "public");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === "index.html") out.push(full);
  }
  return out;
}

const pages = walk(ROOT).sort();
const targets = new Map(); // address -> Set of pages that link to it
let total = 0;

for (const page of pages) {
  const html = fs.readFileSync(page, "utf8");
  const from = "/" + path.relative(ROOT, page).replace(/index\.html$/, "");
  // Strip the fragment and the query first, or /faq/?ref=x reads as a
  // different address from /faq/ and both look broken.
  for (const match of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = match[1];
    total++;
    if (!targets.has(href)) targets.set(href, new Set());
    targets.get(href).add(from);
  }
}

const good = [];
const dead = [];

for (const [href, from] of [...targets].sort()) {
  // "/" is the app itself. It has no index.html in public/ because Vite
  // builds it from preview/index.html (the fashion entry). It is not dead.
  if (href === "/") {
    good.push([href, from.size, "the app"]);
    continue;
  }
  const asFolder = path.join(ROOT, href, "index.html");
  const asFile = path.join(ROOT, href);
  if (fs.existsSync(asFolder)) good.push([href, from.size, "page"]);
  else if (fs.existsSync(asFile) && fs.statSync(asFile).isFile()) {
    good.push([href, from.size, "file"]);
  } else dead.push([href, [...from]]);
}

console.log("pages scanned:      " + pages.length);
console.log("links found:        " + total);
console.log("distinct addresses: " + targets.size);
console.log("");
console.log("--- resolves ---");
for (const [href, count, kind] of good) {
  console.log("  OK   " + href.padEnd(38) + count + " page(s) link here   [" + kind + "]");
}

if (dead.length) {
  console.log("");
  console.log("--- BROKEN ---");
  for (const [href, from] of dead) {
    console.log("  DEAD " + href + "   linked from: " + from.join(", "));
  }
}

console.log("");
console.log(
  dead.length
    ? "FAIL — " + dead.length + " dead address(es)"
    : "PASS — every address has a page"
);
process.exit(dead.length ? 1 : 0);
