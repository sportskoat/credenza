// The preflight script is the only thing standing between a missing .env and
// a production bundle with no sign-in in it. That failure is silent at run
// time, so the guard itself has to be guarded.
//
// These tests run the real script as a child process with a controlled env,
// because the exit code IS the contract — `npm run build` chains on `&&`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PREVIEW = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(PREVIEW, "scripts", "preflight-env.js");

// Run the script with an env we control. `env` replaces process.env entirely
// for the child, so a value in the developer's real shell cannot make a
// failing case pass.
function run(env) {
  try {
    const stdout = execFileSync("node", [SCRIPT], {
      cwd: PREVIEW,
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
    });
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: err.status, out: (err.stdout || "") + (err.stderr || "") };
  }
}

// The script falls back to preview/.env when a key is absent from process.env.
// That file is machine state and is not in git, so no test may depend on it.
// The pass case supplies every required key explicitly. The failing case sets
// its key to whitespace rather than deleting it, so the fallback never fires.
const EXAMPLE = readFileSync(join(PREVIEW, ".env.example"), "utf8");

// Parse .env.example the same way the script does, so the test knows the same
// required set without repeating the list.
function requiredKeys() {
  const out = [];
  let optionalNext = false;
  for (const raw of EXAMPLE.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      optionalNext = /^#\s*optional\s*$/i.test(line);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    if (!optionalNext) out.push(line.slice(0, eq).trim());
    optionalNext = false;
  }
  return out;
}

const REQUIRED = requiredKeys();
const allPresent = Object.fromEntries(REQUIRED.map((k) => [k, "test-value"]));

describe(".env.example is a usable key list", () => {
  it("marks at least the two Supabase keys as required", () => {
    // These two are the whole reason the script exists. If a future edit marks
    // one optional, the silent-broken-build hole reopens.
    expect(REQUIRED).toContain("VITE_SUPABASE_URL");
    expect(REQUIRED).toContain("VITE_SUPABASE_ANON_KEY");
  });

  it("carries no secret value", () => {
    // .env.example IS committed. A filled-in value here is a leaked secret.
    for (const line of EXAMPLE.split(/\r?\n/)) {
      if (line.trim().startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      expect(line.slice(eq + 1).trim()).toBe("");
    }
  });

  it("names no server-only secret as a VITE_ key", () => {
    // A VITE_ var is compiled into the browser bundle. Any of these prefixed
    // with VITE_ would publish it to every visitor.
    for (const secret of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "ANTHROPIC_API_KEY",
      "CREDENZA_ENTITLEMENT_SECRET",
    ]) {
      expect(EXAMPLE).not.toContain("VITE_" + secret);
    }
  });
});

describe("the preflight passes when every required key has a value", () => {
  const res = run(allPresent);

  it("exits 0", () => {
    expect(res.code).toBe(0);
  });

  it("says how many keys it checked", () => {
    expect(res.out).toContain(`${REQUIRED.length} required key(s) present`);
  });
});

describe("the preflight stops the build when a required key is missing", () => {
  // Blank the key rather than deleting it: an empty string must fail too. A
  // deleted key would let the script fall through to preview/.env, which
  // exists on this machine and would mask the failure.
  const res = run({ ...allPresent, VITE_SUPABASE_ANON_KEY: "   " });

  it("exits non-zero, so `&& vite build` never runs", () => {
    expect(res.code).toBe(1);
  });

  it("names the key that is missing", () => {
    expect(res.out).toContain("VITE_SUPABASE_ANON_KEY");
  });

  it("explains the failure mode, not just the symptom", () => {
    // "missing key" is not actionable. "your bundle will have no sign-in and
    // nothing will warn you" is.
    expect(res.out).toContain("AUTH_ENABLED");
  });

  it("says how to get the value back", () => {
    expect(res.out).toContain("netlify env:get VITE_SUPABASE_ANON_KEY");
  });
});

describe("the build actually runs it", () => {
  const pkg = JSON.parse(readFileSync(join(PREVIEW, "package.json"), "utf8"));

  it("chains preflight before vite build", () => {
    // `&&` and not `;` — a shipped-broken build is the exact thing this
    // prevents, so the build must stop on a non-zero exit.
    for (const name of ["build", "build:fashion"]) {
      expect(pkg.scripts[name]).toBe("node scripts/preflight-env.js && vite build");
    }
  });
});
