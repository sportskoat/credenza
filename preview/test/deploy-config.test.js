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
