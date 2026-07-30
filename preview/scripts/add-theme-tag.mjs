// Put the theme reader on every static page under preview/public.
//
// Two edits per page (Kyle 2026-07-30, option B):
//   1. <html lang="en"> gains data-theme="dark", so the page is dark before
//      any script runs and with JavaScript switched off.
//   2. A blocking <script src="/theme.js"> goes in the head, right after the
//      charset meta. It reads the colour the visitor picked in the app and
//      moves the page to light when that is the choice.
//
// The static site is hand-written HTML — there is no template and no head
// include, so both edits have to exist in each file. Running this twice is a
// no-op. preview/test/public-site.test.js fails if a page loses either edit.
//
// Run it from preview/:  node scripts/add-theme-tag.mjs
// Add --check to report incomplete pages without writing (used in review).
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { relative, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// The same walk add-analytics-tag.mjs uses. It is copied rather than imported:
// that file runs its work at import time, so importing it would rewrite pages.
function htmlPages(dir = publicDir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...htmlPages(full));
    else if (name.endsWith(".html")) out.push(full);
  }
  return out.sort();
}

// google…html is the Search Console proof file: Google reads its exact bytes.
function isPage(relPath) {
  return !/^google[0-9a-f]+\.html$/.test(relPath);
}

export const THEME_TAG_LINE = '<script src="/theme.js"></script>';
const BLOCK = [
  "    <!-- The page follows the colour picked in the app. Blocking on purpose:",
  "         a deferred read runs after the first paint and the colour jumps. -->",
  "    " + THEME_TAG_LINE,
].join("\n");

export function hasThemeTag(html) {
  return html.includes(THEME_TAG_LINE);
}

export function hasDarkDefault(html) {
  return /<html[^>]*\sdata-theme="dark"/.test(html);
}

const check = process.argv.includes("--check");
const pages = htmlPages().filter((p) => isPage(relative(publicDir, p)));
const problems = [];

for (const page of pages) {
  const rel = relative(publicDir, page);
  let html = readFileSync(page, "utf8");
  const needsTag = !hasThemeTag(html);
  const needsAttr = !hasDarkDefault(html);
  if (!needsTag && !needsAttr) continue;
  if (check) {
    problems.push(rel);
    continue;
  }
  if (needsAttr) {
    if (!/<html\b[^>]*>/.test(html)) {
      problems.push(rel + " (no <html> tag)");
      continue;
    }
    html = html.replace(/<html\b([^>]*)>/, (m, attrs) => `<html${attrs} data-theme="dark">`);
  }
  if (needsTag) {
    if (!html.includes("</head>")) {
      problems.push(rel + " (no </head>)");
      continue;
    }
    // After the charset meta, so the character set still lands in the first
    // bytes of the file. A page with no charset meta takes the head opening.
    const anchor = /([ \t]*)<meta charset=[^>]*>\n/i.test(html)
      ? /([ \t]*)<meta charset=[^>]*>\n/i
      : /([ \t]*)<head>\n/i;
    html = html.replace(anchor, (m) => m + BLOCK + "\n");
  }
  writeFileSync(page, html, "utf8");
  console.log("updated " + rel);
}

if (problems.length) {
  console.error(check ? "pages missing the theme reader:" : "could not update:");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(check ? "every page carries the theme reader" : "done: " + pages.length + " page(s) checked");
