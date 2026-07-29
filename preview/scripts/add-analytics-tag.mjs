// Put the visitor counter on every static page under preview/public.
//
// The static site is hand-written HTML — there is no template and no head
// include, so the one <script src="/analytics.js"> line has to exist in each
// file. This script writes that line, and writing it twice is a no-op, so it is
// safe to run again after any page rewrite. preview/test/analytics.test.js
// fails if a page is missing it.
//
// Run it from preview/:  node scripts/add-analytics-tag.mjs
// Add --check to report missing pages without writing (used in review).
import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");

export const TAG_LINE = '<script src="/analytics.js" defer></script>';
const BLOCK = [
  "    <!-- Visitor counting. The file holds the measurement id and the consent",
  "         rule; nothing is stored on the device until the visitor accepts. -->",
  "    " + TAG_LINE,
].join("\n");

export function htmlPages(dir = publicDir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...htmlPages(full));
    else if (name.endsWith(".html")) out.push(full);
  }
  return out.sort();
}

export function hasTag(html) {
  return html.includes(TAG_LINE);
}

// Not pages. google…html is the Search Console proof file: Google reads its
// exact bytes, so one extra character breaks the site verification.
export function isPage(relPath) {
  return !/^google[0-9a-f]+\.html$/.test(relPath);
}

const check = process.argv.includes("--check");
const pages = htmlPages().filter((p) => isPage(relative(publicDir, p)));
const missing = [];

for (const page of pages) {
  const html = readFileSync(page, "utf8");
  if (hasTag(html)) continue;
  if (!html.includes("</head>")) {
    // A page with no head cannot carry a script in the head. Report it rather
    // than guessing a position.
    missing.push(relative(publicDir, page) + " (no </head>)");
    continue;
  }
  if (check) {
    missing.push(relative(publicDir, page));
    continue;
  }
  // Match the whitespace in front of </head> so the new lines keep the
  // indentation the page already uses.
  const next = html.replace(/([ \t]*)<\/head>/, (m, indent) => BLOCK + "\n" + indent + "</head>");
  writeFileSync(page, next, "utf8");
  console.log("added " + relative(publicDir, page));
}

if (check && missing.length) {
  console.error("missing the counter on " + missing.length + " page(s):");
  for (const m of missing) console.error("  " + m);
  process.exit(1);
}
if (!check && missing.length) {
  console.error("could not place the counter:");
  for (const m of missing) console.error("  " + m);
  process.exit(1);
}
console.log(check ? "every page carries the counter" : "done: " + pages.length + " page(s) checked");
