#!/usr/bin/env node
// Build preflight: refuse to build without the VITE_ keys the app needs.
//
// Why this exists. `AUTH_ENABLED` in preview/src/auth.js is
// `!!(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)`. Vite inlines that at build
// time, so a build with no .env produces a bundle where the whole account
// section is simply absent. Nothing throws. Nothing logs. The app looks fine
// and nobody can sign in. Production shipped exactly that once.
//
// A silent wrong build is worse than a loud failed one. This script makes it
// loud.
//
// The key list is NOT hard-coded here. It is read from .env.example, so adding
// a key to that file is what makes the build start checking it. A key is
// required unless the line directly above it reads `# optional`.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

// Parse a dotenv-style file into { keys: [{name, optional}], values: Map }.
// Deliberately small: KEY=VALUE, `#` comments, optional surrounding quotes.
// No expansion, no multiline. If .env ever needs more than that, use dotenv.
function parseEnvFile(path) {
  const keys = [];
  const values = new Map();
  if (!existsSync(path)) return { keys, values, exists: false };

  let optionalNext = false;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      // A bare `# optional` marks the very next key. Any other comment
      // clears the flag, so a stray marker cannot leak down the file.
      optionalNext = /^#\s*optional\s*$/i.test(line);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const name = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    keys.push({ name, optional: optionalNext });
    values.set(name, value);
    optionalNext = false;
  }
  return { keys, values, exists: true };
}

const examplePath = join(ROOT, ".env.example");
const example = parseEnvFile(examplePath);

if (!example.exists) {
  console.error("\npreflight: preview/.env.example is missing.");
  console.error("That file is the key list. Restore it from git before building.\n");
  process.exit(1);
}

const required = example.keys.filter((k) => !k.optional).map((k) => k.name);
if (required.length === 0) {
  // Guard the guard. An .env.example that parsed to nothing would let every
  // build through while looking like it checked something.
  console.error("\npreflight: .env.example lists no required key.");
  console.error("Either the file is malformed or every key is marked optional.\n");
  process.exit(1);
}

// Vite reads .env, .env.local and .env.<mode> — later files win. Netlify and CI
// instead put the values straight in process.env. Check the same union, so the
// preflight passes exactly when the build would find the value.
const mode = process.env.NODE_ENV === "development" ? "development" : "production";
const fileValues = new Map();
for (const name of [".env", `.env.${mode}`, ".env.local", `.env.${mode}.local`]) {
  for (const [k, v] of parseEnvFile(join(ROOT, name)).values) fileValues.set(k, v);
}
const lookup = (name) => {
  const fromProcess = process.env[name];
  if (fromProcess !== undefined && fromProcess !== "") return fromProcess;
  return fileValues.get(name) || "";
};

const missing = required.filter((name) => !lookup(name).trim());

if (missing.length) {
  const dotenv = join(ROOT, ".env");
  console.error("\n  BUILD STOPPED — the app would ship broken.\n");
  console.error("  These keys are required and empty:\n");
  for (const name of missing) console.error("    " + name);
  console.error("");
  if (missing.some((n) => n.startsWith("VITE_SUPABASE_"))) {
    console.error("  Without both VITE_SUPABASE_ keys, AUTH_ENABLED compiles to");
    console.error("  false and the bundle has no sign-in at all. Nothing warns you");
    console.error("  at run time — the account section is simply not there.\n");
  }
  console.error(
    existsSync(dotenv)
      ? "  preview/.env exists. Set them there, or in the build environment."
      : "  preview/.env does not exist. Copy .env.example to .env."
  );
  console.error("\n  Read the live values back from Netlify:\n");
  for (const name of missing) console.error("    npx netlify env:get " + name);
  console.error("\n  Keys are listed in preview/.env.example. A key there is");
  console.error("  required unless the line above it reads `# optional`.\n");
  process.exit(1);
}

const optionalEmpty = example.keys.filter((k) => k.optional && !lookup(k.name).trim()).length;
console.log(
  `preflight: ${required.length} required key(s) present` +
    (optionalEmpty ? `, ${optionalEmpty} optional key(s) unset` : "")
);
