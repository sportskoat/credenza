// One-shot migration for Kyle's option B (2026-07-29): give every public page
// the shared stylesheet and the shared header.
//
// Run once from preview/:  node scripts/migrate-public-header.mjs --write
// Without --write it reports what it would change and touches nothing.
//
// It is kept in the tree because the next person who adds a public page needs
// to see the exact shape the page must have. The test file is the enforcement;
// this is the explanation.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const WRITE = process.argv.includes("--write");

// ── the shared header, byte for byte the same on every page ────────────────
const MARK = `<svg class="mark" viewBox="0 0 40 40" width="30" height="30" aria-hidden="true" focusable="false">
            <rect width="40" height="40" rx="12.4" fill="#0f1114"/>
            <path fill="#e9edf2" d="M21.30 27.80Q19.21 27.80 17.64 26.50Q16.07 25.20 15.21 22.84Q14.34 20.48 14.34 17.26Q14.34 14.15 15.29 11.81Q16.24 9.48 17.84 8.20Q19.43 6.91 21.39 6.91Q22.54 6.91 23.42 7.12Q24.30 7.33 24.98 7.67Q25.32 7.87 25.32 8.27L25.40 12.56Q25.40 13.04 25.06 13.04Q24.75 13.04 24.67 12.68L24.38 11.63Q23.79 9.43 23.01 8.58Q22.23 7.73 21.16 7.73Q19.18 7.73 17.87 10.17Q16.55 12.62 16.55 17.26Q16.55 20.42 17.21 22.60Q17.88 24.78 18.94 25.88Q20.00 26.98 21.19 26.98Q22.46 26.98 23.24 26.19Q24.02 25.40 24.55 23.14L24.89 21.75Q24.98 21.33 25.34 21.39Q25.66 21.44 25.66 21.87L25.54 26.45Q25.54 26.84 25.17 27.04Q24.50 27.38 23.58 27.59Q22.66 27.80 21.30 27.80Z"/>
            <rect x="11.03" y="29.66" width="17.93" height="2.76" rx="1.38" fill="#4da3ff"/>
          </svg>`;

// The way into the app is the app's own avatar ring, not a wide pill (Kyle
// 2026-07-30: "I don't want there to be any difference"). A visitor is signed
// out, so the app draws the lucide User glyph at 17px, stroke 2.2
// (credenza-fashion.jsx:8352). This is that glyph, inlined.
const PERSON = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

// The same six the app's masthead carries (components/site-nav.js), in the
// same order. About, Privacy, Terms and llms.txt stay in the footer: eleven
// links do not fit in a header row.
const NAV = [
  ["/how/", "How it works"],
  ["/guides/", "Guides"],
  ["/pricing/", "Pricing"],
  ["/faq/", "FAQ"],
  ["/support/", "Support"],
  ["/contact/", "Contact"],
];

function head(current) {
  const links = NAV.map(([href, label]) => {
    const here = href === current ? ' aria-current="page"' : "";
    return `          <a href="${href}"${here}>${label}</a>`;
  }).join("\n");
  return `      <div class="site-head">
        <a class="brand" href="/landing/">
          ${MARK}
          <span class="brand-name">
            <span class="wordmark">CREDENZA</span>
            <span class="kicker">Fashion</span>
          </span>
        </a>
        <nav class="nav" aria-label="Site">
${links}
        </nav>
        <a class="nav-open" href="/" aria-label="Open app" title="Open app">${PERSON}</a>
      </div>`;
}

// Which nav link owns this page. A guide detail page belongs to /guides/.
function section(rel) {
  const top = "/" + rel.split("/")[0] + "/";
  return NAV.some(([href]) => href === top) ? top : "";
}

// ── CSS rule splitter ──────────────────────────────────────────────────────
// Top-level rules only, braces counted so @media and @font-face stay whole.
function rules(css) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") { if (depth === 0) start = start; depth++; }
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) { out.push(css.slice(start, i + 1)); start = i + 1; }
    }
  }
  const tail = css.slice(start);
  if (tail.trim()) out.push(tail);
  return out;
}

// Compare rules ignoring indentation and comments, so a rule that moved into
// site.css is recognised whatever whitespace the page used.
const norm = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();

// The selector a rule opens with, normalised. Byte-identical matching is not
// enough: a page that redefines h2 with one different margin still wins over
// site.css, because a page's own <style> comes after the <link>. So the rule
// is by SELECTOR — if site.css styles it, the page does not get a second
// opinion. Anything a page genuinely needs to differ on goes in site.css.
const selectorOf = (r) => {
  const head = r.slice(0, r.indexOf("{"));
  return norm(head).replace(/\s*,\s*/g, ", ");
};

const SHARED_CSS = readFileSync(join(PUBLIC, "site.css"), "utf8");
const SHARED = new Set(rules(SHARED_CSS).map(norm).filter(Boolean));
const OWNED = new Set(
  rules(SHARED_CSS)
    .filter((r) => r.includes("{"))
    .map(selectorOf)
    .filter(Boolean)
);

// A rule the shared sheet owns. @font-face and the dark-mode token block are
// owned outright; both exist verbatim in site.css on every page today.
function owned(rule) {
  if (!rule.includes("{")) return false;
  const sel = selectorOf(rule);
  if (sel === "@font-face") return true;
  if (OWNED.has(sel)) return true;
  // "@media (prefers-color-scheme: dark)" only ever holds the :root tokens.
  if (/^@media \(prefers-color-scheme: dark\)$/.test(sel)) return true;
  return false;
}

// The colours and spacings site.css defines. Dropping a page's :root wholesale
// is wrong when the page defined MORE than the shared set — /landing/ names 23
// of its own (--action, --tile-weidian, --status-qc-bg …) and every one of
// them would resolve to nothing. Keep the extras, drop the duplicates.
// Light and dark are read SEPARATELY. Most tokens are declared twice in
// site.css — --bg is #f4f4f0 in :root and #000000 in the dark block — so one
// flat map keeps only the dark value, every page's light --bg looks like an
// override, and all 36 pages "rescue" a copy of the palette they already
// share. Two maps, compared in their own context.
function tokenMap(css) {
  return new Map(
    [...css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
  );
}
const darkBlock = SHARED_CSS.match(
  /@media \(prefers-color-scheme: dark\)\s*\{([\s\S]*?)\n\}/
);
const SHARED_TOKENS = {
  light: tokenMap(SHARED_CSS.slice(0, darkBlock ? SHARED_CSS.indexOf(darkBlock[0]) : undefined)),
  dark: tokenMap(darkBlock ? darkBlock[1] : ""),
};

// Pull the custom properties a page still needs out of a :root rule, in source
// order. Two kinds survive: the ones site.css never heard of, and the ones it
// defines DIFFERENTLY — /landing/ sets --max to 1120px because it is a wide
// marketing page, while the article pages read at 40rem. Dropping that on the
// grounds that "--max is shared" silently narrowed the whole page to 640px and
// every test still passed, because the token still resolved. It resolved to
// the wrong number.
// Read one declaration at a time, NOT one line at a time. /landing/ sets
// --photo-scrim to a linear-gradient() spread over five lines; a line-by-line
// scan never matched it, dropped it, and the scrim over the landing photos
// silently became nothing. Split on the semicolons that sit outside brackets.
function declarations(body) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === ";" && depth === 0) {
      out.push(body.slice(start, i));
      start = i + 1;
    }
  }
  if (body.slice(start).trim()) out.push(body.slice(start));
  return out;
}

// The contents of the ":root { … }" block inside a rule, brace-matched. Works
// for a bare ":root { … }" and for "@media (…) { :root { … } }" alike.
function rootBody(rule) {
  const at = rule.indexOf(":root");
  if (at < 0) return "";
  const open = rule.indexOf("{", at);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < rule.length; i++) {
    if (rule[i] === "{") depth++;
    else if (rule[i] === "}" && --depth === 0) return rule.slice(open + 1, i);
  }
  return "";
}

function extraTokens(rule, scheme) {
  const shared = SHARED_TOKENS[scheme];
  // The dark rule is "@media (…) { :root { … } }", so read the :root block
  // itself. Reading the outer one leaves ":root {" glued to the first
  // declaration and every dark token is skipped without a word.
  const body = rootBody(rule);
  const out = [];
  for (const raw of declarations(body)) {
    // A declaration carries the comment that sits above it, and /landing/
    // documents most of its tokens. Strip the comment or the match fails and
    // the token vanishes — that is how --photo-scrim was lost.
    const decl = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    const m = decl.match(/^\s*(--[a-z0-9-]+)\s*:([\s\S]+)$/);
    if (!m) continue;
    const name = m[1];
    const value = m[2].trim();
    // Compare on collapsed whitespace: site.css and the page may wrap the
    // same gradient differently, and that is not a difference.
    const flat = (s) => (s || "").replace(/\s+/g, " ").trim();
    if (flat(shared.get(name)) === flat(value)) continue;
    out.push(`  ${name}: ${value};`);
  }
  return out;
}

function pages(dir = PUBLIC, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (["fonts", "img", "assets"].includes(e.name)) continue;
      pages(join(dir, e.name), out);
    } else if (e.name === "index.html") {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

// 404.html is a page a reader lands on, so it carries the same header and the
// same stylesheet. It is not an index.html, so the walk above misses it —
// which is exactly how it kept a stale nav the last time the site changed.
const EXTRA_PAGES = [join(PUBLIC, "404.html")];

let changed = 0;
const report = [];

for (const file of [...pages(), ...EXTRA_PAGES]) {
  const rel = file.slice(PUBLIC.length + 1).replace(/index\.html$/, "");
  let src = readFileSync(file, "utf8");
  const before = src;

  // 1. link the shared stylesheet, once, just before the page's own <style>
  if (!src.includes('href="/site.css"')) {
    src = src.replace(
      /(\n\s*)<style>/,
      `$1<link rel="stylesheet" href="/site.css" />$1<style>`
    );
  }

  // 2. drop every rule the shared stylesheet now owns
  let dropped = 0;
  src = src.replace(/<style>([\s\S]*?)<\/style>/, (m, css) => {
    // /landing/ styled a header row that no longer exists. Its rules would
    // otherwise sit in the file forever, describing markup nobody can see.
    const DEAD = /^\s*\.(topnav|topnav-inner|topnav-links|pill-cta)\b/;
    const rescued = { light: [], dark: [] };
    let keep = rules(css).filter((r) => {
      const n = norm(r);
      if (!n) return false;
      if (SHARED.has(n) || owned(r)) {
        // Rescue the page's own tokens before the rule that held them goes.
        const sel = selectorOf(r);
        if (sel === ":root") rescued.light.push(...extraTokens(r, "light"));
        if (/^@media \(prefers-color-scheme: dark\)$/.test(sel)) {
          rescued.dark.push(...extraTokens(r, "dark"));
        }
        dropped++;
        return false;
      }
      if (r.includes("{") && DEAD.test(selectorOf(r))) { dropped++; return false; }
      return true;
    });
    if (rescued.light.length) {
      keep.unshift(`:root {\n${rescued.light.join("\n")}\n}`);
    }
    if (rescued.dark.length) {
      keep.unshift(
        `@media (prefers-color-scheme: dark) {\n  :root {\n${rescued.dark
          .map((l) => "  " + l)
          .join("\n")}\n  }\n}`
      );
    }
    // The same dead selectors nested one level down, inside a @media block —
    // and the @media block itself once it holds nothing.
    keep = keep
      .map((r) => r.replace(/\n?[ \t]*\.(topnav|topnav-inner|topnav-links|pill-cta)\b[^{}]*\{[^{}]*\}/g, ""))
      .filter((r) => !/^@media[^{]*\{\s*\}$/.test(norm(r)));

    if (!keep.length) return "";
    return "<style>\n" + keep.map((r) => "      " + r.trim()).join("\n\n") + "\n    </style>";
  });
  // A page whose every rule moved into site.css keeps no <style> at all.
  src = src.replace(/\n[ \t]*\n(\s*<\/head>)/, "\n$1");

  // 3. the old underlined link run goes away; the footer keeps the long tail.
  //
  // ORDER MATTERS, and getting it wrong is silent. The shared header contains
  // a <nav class="nav"> of its own, so removing the old nav AFTER inserting
  // the header deletes the new one instead — the first match in the file wins.
  // Every page then ends up identically wrong, which no same-as-each-other
  // check can see. Remove first, insert second.
  src = src.replace(/[ \t]*<nav class="nav"[^>]*>[\s\S]*?<\/nav>\n/, "");

  // 4. the shared header replaces the old brand paragraph
  const brand = src.match(/[ \t]*<p class="brand">[\s\S]*?<\/p>\n/);
  if (brand) src = src.replace(brand[0], head(section(rel)) + "\n");

  // /landing/ is the one page that already had a header row of its own. It
  // carried three in-page jump links (#how, #size, #trust) mixed in with the
  // site links, and its button said "Open the app" while nothing else did.
  // It takes the same header as the other 34 pages. Kyle 2026-07-29: the
  // headers must match. The three jump links go; the sections they pointed at
  // are the next thing on the page.
  src = src.replace(
    /[ \t]*<header class="topnav">[\s\S]*?<\/header>\n/,
    `    <header>\n${head("")}\n    </header>\n`
  );

  if (src !== before) {
    changed++;
    report.push(`${dropped ? String(dropped).padStart(2) : " -"} rules dropped  ${rel || "/"}`);
    if (WRITE) writeFileSync(file, src);
  }
}

console.log(report.join("\n"));
console.log(`\n${changed} pages ${WRITE ? "written" : "would change"}`);
