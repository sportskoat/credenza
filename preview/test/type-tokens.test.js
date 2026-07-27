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

  it("every public page uses the tokens and defines them locally", () => {
    const pages = htmlPages(PUBLIC);
    expect(pages.length).toBeGreaterThan(20);
    let withType = 0;
    for (const file of pages) {
      const text = fs.readFileSync(file, "utf8");
      const values = declarations(text);
      if (!values.length) continue;
      withType++;
      const where = path.relative(PUBLIC, file);
      for (const value of values) {
        expect(isToken(value), `${where} declares font-family: ${value}`).toBe(true);
      }
      // A page that USES a token must also DEFINE it: these pages carry their
      // own chrome and share no stylesheet, so an undefined token renders in
      // the browser default face — the exact drift this test exists to stop.
      for (const token of TOKENS) {
        if (!text.includes(`var(${token})`)) continue;
        expect(text, `${where} uses ${token} without defining it`).toMatch(
          new RegExp(`${token}\\s*:\\s*\\S`)
        );
      }
    }
    expect(withType).toBeGreaterThan(20);
  });
});
