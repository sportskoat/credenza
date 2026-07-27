// LB-34. netlify.toml is the deploy contract, and nothing asserted it.
//
// Found by negative controls. Five separate edits to netlify.toml all passed
// with the suite green at 1503:
//
//   1. /s/* rewritten to a function name that does not exist  → every share
//      link 404s
//   2. publish = "build" instead of "dist"                    → the deploy
//      ships an empty site
//   3. functions = "netlify/fns"                              → every function
//      404s: checkout, share, resolve, entitlement
//   4. X-Content-Type-Options renamed                         → a security
//      header silently stops being sent
//   5. the apex redirect reversed to point at www             → an infinite
//      redirect loop on the canonical host
//
// None of these is visible in a test that runs locally, because vitest never
// reads this file. They are visible after a deploy, to visitors. Kyle ships
// once and carries every batch, so a broken toml is not a fast rollback — it is
// the whole batch.
//
// This file parses the toml itself rather than importing a parser, because the
// repo has no toml dependency and adding one to test six values is the wrong
// trade. The parse is deliberately narrow: it handles the [[array]] tables and
// key = "value" pairs this file uses, and nothing else.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PREVIEW = join(dirname(fileURLToPath(import.meta.url)), "..");
const toml = readFileSync(join(PREVIEW, "netlify.toml"), "utf8");

// Split into blocks on [table] / [[array]] headers, keeping the header. Good
// enough for this file's shape and honest about being nothing more.
function blocks(text) {
  const out = [];
  let current = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const header = /^\[\[?([A-Za-z.]+)\]?\]$/.exec(line);
    if (header) {
      current = { name: header[1], values: {} };
      out.push(current);
      continue;
    }
    // Values are quoted strings ("dist") or bare scalars (301, true). Both are
    // normalised to strings — the rules below compare against "301", not 301,
    // and a bare value that stayed undefined would make an assertion vacuous.
    const pair = /^([A-Za-z-]+)\s*=\s*(.*)$/.exec(line);
    if (!pair) continue;
    const value = pair[2].trim().replace(/^"(.*)"$/, "$1");
    if (current) current.values[pair[1]] = value;
    else out.push({ name: "", values: { [pair[1]]: value } });
  }
  return out;
}

const parsed = blocks(toml);
const redirects = parsed.filter((b) => b.name === "redirects");
const headers = parsed.filter((b) => b.name === "headers" || b.name === "headers.values");
const build = parsed.find((b) => b.name === "build");

describe("the deploy contract", () => {
  it("parses into the blocks the rules below need", () => {
    // Without this, a change to the file's shape would empty every list and
    // each assertion below would pass by checking nothing. This suite exists
    // because five real breakages were silent; it must not become silent
    // itself.
    expect(build, "netlify.toml has no [build] block").toBeTruthy();
    expect(redirects.length, "netlify.toml declares no redirects").toBeGreaterThanOrEqual(2);
    expect(parsed.length, "netlify.toml parsed to almost nothing").toBeGreaterThanOrEqual(10);
  });

  it("publishes the directory vite actually builds", () => {
    // vite.config builds to dist/. A mismatch here deploys an empty site, and
    // it looks like a successful deploy in the Netlify UI.
    expect(build.values.publish, "[build] publish").toBe("dist");
    expect(build.values.command, "[build] command").toBe("npm run build");
  });

  it("points at a functions directory that exists and holds the functions", () => {
    const dir = build.values.functions;
    expect(dir, "[build] functions").toBe("netlify/functions");
    const full = join(PREVIEW, dir);
    expect(existsSync(full), `${dir} does not exist`).toBe(true);
    // The four the app cannot work without. checkout and entitlement are the
    // paid path; resolve is every paste; share is LB-8.
    for (const fn of ["checkout.js", "entitlement.js", "resolve.js", "share.js"]) {
      expect(existsSync(join(full, fn)), `${dir}/${fn} is missing`).toBe(true);
    }
  });
});

describe("every rewrite points at something that exists", () => {
  it("sends /s/* to a share-page function that is really there", () => {
    // A typo here 404s every shared link, and shares are the growth loop. The
    // visitor sees a dead page; nothing in this repo notices.
    const share = redirects.find((r) => r.values.from === "/s/*");
    expect(share, "netlify.toml no longer rewrites /s/*").toBeTruthy();
    // status 200 rewrites without a redirect, so the address bar keeps
    // /s/<code>. A 301 here would change the URL people paste into Discord.
    expect(share.values.status, "/s/* status").toBe("200");
    const target = share.values.to;
    expect(target.startsWith("/.netlify/functions/"), `/s/* target ${target}`).toBe(true);
    const name = target.slice("/.netlify/functions/".length);
    const files = readdirSync(join(PREVIEW, build.values.functions));
    expect(
      files.includes(name + ".js"),
      `/s/* rewrites to ${name}, which is not a file in ${build.values.functions}`
    ).toBe(true);
  });

  it("redirects www to the apex, and not the other way round", () => {
    // Reversed, this is an infinite loop on the canonical host: the apex is
    // where every canonical tag, the sitemap, and robots.txt point.
    const www = redirects.find((r) => (r.values.from || "").includes("www."));
    expect(www, "netlify.toml has no www redirect").toBeTruthy();
    expect(www.values.to.includes("www."), "the www redirect points back at www").toBe(false);
    expect(www.values.to.startsWith("https://credenzafashion.com/"), "www redirect target").toBe(true);
    expect(www.values.status, "www redirect status").toBe("301");
  });

  it("declares no rewrite to a .netlify function file that is missing", () => {
    const files = new Set(readdirSync(join(PREVIEW, build.values.functions)));
    for (const r of redirects) {
      const to = r.values.to || "";
      if (!to.startsWith("/.netlify/functions/")) continue;
      const name = to.slice("/.netlify/functions/".length).split("/")[0];
      expect(files.has(name + ".js"), `${r.values.from} rewrites to a missing function ${name}`).toBe(true);
    }
  });
});

describe("the baseline security headers still ship", () => {
  // These are set once, for /*, and never looked at again. A rename is not a
  // visible failure — the header simply stops being sent, and the only way to
  // find out is to check response headers on the live site.
  const all = headers.map((h) => h.values);
  const merged = Object.assign({}, ...all);

  it("found the header block", () => {
    expect(headers.length, "netlify.toml declares no headers").toBeGreaterThanOrEqual(3);
  });

  it("sets the four baseline headers, spelled correctly", () => {
    expect(merged["X-Content-Type-Options"], "X-Content-Type-Options").toBe("nosniff");
    expect(merged["Referrer-Policy"], "Referrer-Policy").toBe("strict-origin-when-cross-origin");
    expect(merged["X-Frame-Options"], "X-Frame-Options").toBe("SAMEORIGIN");
    expect(merged["Permissions-Policy"], "Permissions-Policy").toBeTruthy();
  });

  it("denies camera, microphone and geolocation, which the app never uses", () => {
    const policy = merged["Permissions-Policy"];
    for (const feature of ["camera", "microphone", "geolocation"]) {
      expect(policy.includes(`${feature}=()`), `Permissions-Policy does not deny ${feature}`).toBe(true);
    }
  });

  it("agrees with public/_headers on every path both files declare", () => {
    // Netlify reads BOTH files and merges them. Two sources for one contract
    // means they can disagree, and the loser is whichever one the next person
    // did not edit. Nothing here would notice: the site keeps serving, just
    // with a header somebody thought they had changed.
    const hd = readFileSync(join(PREVIEW, "public/_headers"), "utf8");
    const fileBlocks = {};
    let current = null;
    for (const raw of hd.split("\n")) {
      if (/^\//.test(raw)) {
        current = raw.trim();
        fileBlocks[current] = {};
      } else if (current && /^\s+\S/.test(raw)) {
        const [k, ...rest] = raw.trim().split(":");
        fileBlocks[current][k.trim()] = rest.join(":").trim();
      }
    }

    expect(Object.keys(fileBlocks).length, "_headers parsed to nothing").toBeGreaterThanOrEqual(8);

    const tomlFor = (path) => {
      const i = parsed.findIndex((b) => b.name === "headers" && b.values.for === path);
      return i >= 0 ? parsed[i + 1]?.values || {} : null;
    };

    const disagreements = [];
    for (const [path, values] of Object.entries(fileBlocks)) {
      const other = tomlFor(path);
      if (!other) {
        disagreements.push(`${path}: declared in _headers, absent from netlify.toml`);
        continue;
      }
      for (const [key, value] of Object.entries(values)) {
        // Compare without whitespace: TOML writes "public, max-age=0" and
        // _headers writes the same thing, but a stray space is not a defect.
        const a = value.replace(/\s+/g, "");
        const b = String(other[key] ?? "").replace(/\s+/g, "");
        if (a !== b) disagreements.push(`${path} ${key}: _headers="${value}" netlify.toml="${other[key] ?? "(absent)"}"`);
      }
    }
    // And the reverse. A path only in netlify.toml is the same defect wearing
    // the other hat: somebody edits _headers, sees no effect, and never learns
    // the other file exists.
    for (const block of parsed) {
      if (block.name !== "headers") continue;
      const path = block.values.for;
      if (!path || fileBlocks[path]) continue;
      disagreements.push(`${path}: declared in netlify.toml, absent from _headers`);
    }

    expect(disagreements, "public/_headers and netlify.toml disagree").toEqual([]);
  });

  it("caches the immutable bytes and refuses to cache the service worker", () => {
    // Netlify defaults every file to max-age=0,must-revalidate. The live site
    // was re-sending a 352 KB font and 884 KB of content-hashed JavaScript on
    // every repeat visit — paid bandwidth for bytes that had not changed.
    const forOf = (path) => {
      const i = parsed.findIndex((b) => b.name === "headers" && b.values.for === path);
      return i >= 0 ? parsed[i + 1]?.values || {} : null;
    };
    for (const dir of ["/assets/*", "/fonts/*"]) {
      const cc = forOf(dir)?.["Cache-Control"];
      expect(cc, `${dir} has no Cache-Control`).toBeTruthy();
      expect(cc, `${dir} is not cached for a year`).toContain("max-age=31536000");
      expect(cc, `${dir} is not immutable`).toContain("immutable");
    }

    // The inverse, and the reason the rule above cannot simply say "cache
    // everything". sw.js decides which build a returning visitor runs. Cache it
    // and the stale worker keeps serving its old precache manifest, so a deploy
    // reaches nobody who has visited before.
    const sw = forOf("/sw.js")?.["Cache-Control"];
    expect(sw, "/sw.js has no Cache-Control").toBeTruthy();
    expect(sw, "sw.js must not be cached — a stale worker pins visitors to the old build").toContain("max-age=0");
    expect(sw, "sw.js must not be immutable").not.toContain("immutable");
  });

  it("serves the discovery files as the type a crawler expects", () => {
    // sitemap.xml served as text/html is ignored by search consoles. The
    // failure is silent in a browser, which renders it either way.
    const forOf = (path) => {
      const i = parsed.findIndex((b) => b.name === "headers" && b.values.for === path);
      return i >= 0 ? parsed[i + 1]?.values || {} : null;
    };
    expect(forOf("/sitemap.xml")?.["Content-Type"], "sitemap.xml Content-Type").toContain("application/xml");
    expect(forOf("/robots.txt")?.["Content-Type"], "robots.txt Content-Type").toContain("text/plain");
    expect(forOf("/llms.txt")?.["Content-Type"], "llms.txt Content-Type").toContain("text/plain");
    expect(forOf("/manifest.webmanifest")?.["Content-Type"], "manifest Content-Type").toContain(
      "application/manifest+json"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LB-37. A clean checkout could not build the app, and every local build hid it.
//
// The app root is `../credenza-fashion.jsx` — one level ABOVE this project.
// Node resolves a bare import by walking up from the importing file, so
// `import "framer-motion"` inside it checks `<repo>/node_modules` first and
// never reaches `preview/node_modules`, where package.json declares it.
//
// On this machine that accidentally worked: a stray `<repo>/node_modules` had
// sat there since 2026-07-21. A fresh `git clone` + `npm ci` has no such
// directory. Rollup does not treat the miss as an error — it prints
// UNRESOLVED_IMPORT and externalises the package. The build then "succeeds":
// exit 0, 21 modules instead of 2247, and a bundle importing bare specifiers no
// browser can resolve. Everything that draws an icon or animates is gone.
//
// That is the same shape as the LB-6 regression the launch gate exists to
// prevent — a build that reports success and ships a broken app — and the gate
// box for it ("a fresh build from a clean checkout passes the preflight and
// shows sign-in") was still unchecked. It was unchecked because it was true.
//
// The fix is a resolve.alias pinning these to the copy this project installs.
// These tests assert the alias exists AND that nothing reintroduces a bare
// dependency that could resolve past it.
describe("bare imports resolve on a machine without a stray root node_modules", () => {
  const config = readFileSync(join(PREVIEW, "vite.config.js"), "utf8");
  const pkg = JSON.parse(readFileSync(join(PREVIEW, "package.json"), "utf8"));

  // Everything the app imports by bare name. Read from package.json rather than
  // hardcoded, so adding a dependency cannot quietly escape this rule.
  const BARE = Object.keys(pkg.dependencies ?? {});

  it("declares the runtime dependencies it imports", () => {
    expect(BARE.length, "package.json has no dependencies to check").toBeGreaterThanOrEqual(4);
  });

  it("aliases every runtime dependency to this project's node_modules", () => {
    const alias = config.slice(config.indexOf("alias: {"), config.indexOf("build: {"));
    expect(alias.length, "no resolve.alias block found in vite.config.js").toBeGreaterThan(0);
    const missing = BARE.filter(
      (dep) => !new RegExp(`["']?${dep.replace(/[/\\-]/g, "\\$&")}["']?\\s*:`).test(alias)
    );
    expect(
      missing,
      "these dependencies are imported by name from ../credenza-fashion.jsx but not aliased; " +
        "on a clean checkout they resolve to nothing and rollup externalises them silently"
    ).toEqual([]);
  });

  it("points the aliases at preview/node_modules, not the repo root", () => {
    // The whole defect was resolution landing one level up. An alias written
    // with "../node_modules" would restate the bug in the fix.
    const alias = config.slice(config.indexOf("alias: {"), config.indexOf("build: {"));
    expect(alias, "an alias points above the project root").not.toMatch(/\.\.\/node_modules/);
    for (const dep of BARE) {
      expect(alias, `${dep} is not resolved from this project`).toContain(`node_modules/${dep}`);
    }
  });

  it("keeps the app root outside preview, which is why the alias is needed", () => {
    // If credenza-fashion.jsx ever moves inside preview/, normal resolution
    // works and this rule becomes dead weight. Assert the premise so the next
    // reader learns why the alias exists instead of deleting it as noise.
    expect(existsSync(join(PREVIEW, "../credenza-fashion.jsx")), "app root moved").toBe(true);
    expect(existsSync(join(PREVIEW, "credenza-fashion.jsx")), "app root is now inside preview/; the alias may be removable").toBe(false);
  });
});
