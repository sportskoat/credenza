import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// LB-69 (Kyle 2026-07-27): "Can we make some font standardizations for the
// entire website? They're a little bit more different. They're kind of giving
// regular Claude design, where I want it to be the fonts that the Credenza
// fashion logo is made out of."
//
// The site once spelled these three families ten different ways across
// credenza.css, credenza-fashion.css, credenza-fashion.jsx and 33 public HTML
// pages. Same fonts, different fallback order, different quote marks. Each
// spelling was a place the type could silently drift away from the logo.
//
// The tokens are the fix. This test is what keeps the fix.
//
// It reads the shipped files and asserts on VALUES, never on comments: it
// pulls each font-family declaration and checks the value is a token. A
// comment cannot satisfy it (LB-65), and deleting the tokens cannot make it
// pass — the declarations that reference them would then name literals.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const PUBLIC = path.join(REPO, "preview/public");

const TOKENS = ["--cz-display", "--cz-sans", "--cz-mono"];

// The ONE place a literal stack is correct: the :root block in credenza.css
// that defines the tokens. Everything else must point at it.
const SOURCE_OF_TRUTH = path.join(REPO, "credenza.css");

// Pull every `font-family: <value>` declaration out of CSS text, skipping
// anything inside a /* comment */ so a quoted example cannot fail the build.
function declarations(text) {
  // Strip @font-face blocks too: that rule is the one place besides the
  // :root token block that must name the literal family, since it is what
  // the --cz-sans token points at.
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@font-face\s*{[^}]*}/g, "");
  const out = [];
  const re = /font-family\s*:\s*([^;}]+)/g;
  let m;
  while ((m = re.exec(stripped))) out.push(m[1].trim().replace(/\s*!important$/, ""));
  // The `font:` shorthand also names a family, and seven controls used it to
  // smuggle the old system stack past this test (Kyle 2026-07-27: "the new
  // font is not on here"). Extract the family tail — everything after the
  // size (and optional /line-height) token — and hold it to the same rule.
  const reShort = /(?:^|[;{])\s*font\s*:\s*([^;}]+)/g;
  while ((m = reShort.exec(stripped))) {
    const value = m[1].trim().replace(/\s*!important$/, "");
    const tail = value.match(/[\d.]+(?:px|em|rem|%)(?:\s*\/\s*[\d.]+[a-z%]*)?\s+(.+)$/i);
    out.push((tail ? tail[1] : value).trim());
  }
  return out;
}

function isToken(value) {
  return TOKENS.some((t) => value === `var(${t})`) || value === "inherit";
}

function htmlPages(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) htmlPages(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

describe("Type tokens are the only font stacks (LB-69)", () => {
  it("credenza.css defines all three tokens exactly once", () => {
    const css = fs.readFileSync(SOURCE_OF_TRUTH, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const token of TOKENS) {
      const hits = css.match(new RegExp(`${token}\\s*:`, "g")) || [];
      expect(hits, `${token} definitions in credenza.css`).toHaveLength(1);
    }
    // And each one still names a real family, not an empty value.
    expect(css).toMatch(/--cz-display:\s*Georgia/);
    expect(css).toMatch(/--cz-sans:\s*"Clash Grotesk"/);
    expect(css).toMatch(/--cz-mono:\s*ui-monospace/);
  });

  it("no app stylesheet names a font family of its own", () => {
    for (const rel of ["credenza.css", "credenza-fashion.css"]) {
      const file = path.join(REPO, rel);
      for (const value of declarations(fs.readFileSync(file, "utf8"))) {
        expect(isToken(value), `${rel} declares font-family: ${value}`).toBe(true);
      }
    }
  });

  it("the JSX type constants point at the tokens", () => {
    const jsx = fs.readFileSync(path.join(REPO, "credenza-fashion.jsx"), "utf8");
    expect(jsx).toMatch(/export const FONT = "var\(--cz-sans\)";/);
    expect(jsx).toMatch(/export const DISPLAY = "var\(--cz-display\)";/);
    expect(jsx).toMatch(/export const MONO = "var\(--cz-mono\)";/);
  });

  it("the shared public stylesheet names only tokens", () => {
    // /site.css is where the public site's type lives since Kyle's option B
    // (2026-07-29). It is the one file 36 pages read, so a raw family here
    // would reach every page at once.
    const css = fs.readFileSync(path.join(PUBLIC, "site.css"), "utf8");
    for (const value of declarations(css)) {
      expect(isToken(value), `site.css declares font-family: ${value}`).toBe(true);
    }
    for (const token of TOKENS) {
      expect(css, `site.css does not define ${token}`).toMatch(
        new RegExp(`${token}\\s*:\\s*\\S`)
      );
    }
  });

  it("every public page uses the tokens and can resolve them", () => {
    const pages = htmlPages(PUBLIC);
    expect(pages.length).toBeGreaterThan(20);
    // Before option B this counted pages that declared type inline, because
    // that was the only way a page got any. Now most pages declare none and
    // read /site.css instead, so the guard counts pages this rule actually
    // examined — a refactor that quietly unhooks the sheet drops the count.
    let checked = 0;
    for (const file of pages) {
      const text = fs.readFileSync(file, "utf8");
      const values = declarations(text);
      if (!values.length && !text.includes('href="/site.css"')) continue;
      checked++;
      const where = path.relative(PUBLIC, file);
      for (const value of values) {
        expect(isToken(value), `${where} declares font-family: ${value}`).toBe(true);
      }
      // A page that USES a token must be able to RESOLVE it, or it renders in
      // the browser default face — the drift this test exists to stop. Until
      // 2026-07-29 every page defined its own copy, so "defines it locally"
      // was the whole rule. Kyle's option B moved the shared tokens into
      // /site.css, so a page now satisfies this by linking that sheet. A page
      // that does neither still fails.
      const sharesSheet = text.includes('href="/site.css"');
      for (const token of TOKENS) {
        if (!text.includes(`var(${token})`)) continue;
        const definesLocally = new RegExp(`${token}\\s*:\\s*\\S`).test(text);
        expect(
          sharesSheet || definesLocally,
          `${where} uses ${token} but neither links /site.css nor defines it`
        ).toBe(true);
      }
    }
    expect(checked, "this rule examined almost no pages").toBeGreaterThan(20);
  });
});
