#!/usr/bin/env node
/**
 * Submit Credenza public URLs to IndexNow (Bing and other partners).
 * Key file must be live at https://credenzafashion.com/{key}.txt
 *
 * Usage:
 *   node scripts/indexnow-submit.mjs
 *   INDEXNOW_KEY=... node scripts/indexnow-submit.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const host = "credenzafashion.com";
const base = `https://${host}`;

const urls = [
  `${base}/`,
  `${base}/landing/`,
  `${base}/how/`,
  `${base}/faq/`,
  `${base}/privacy/`,
  `${base}/terms/`,
  `${base}/llms.txt`,
  `${base}/llms-full.txt`,
  `${base}/robots.txt`,
  `${base}/sitemap.xml`,
];

function loadKey() {
  if (process.env.INDEXNOW_KEY) return process.env.INDEXNOW_KEY.trim();
  const candidates = [
    resolve(__dirname, "../public/.well-known/indexnow-key.txt"),
    resolve(__dirname, "../dist/.well-known/indexnow-key.txt"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, "utf8").trim();
  }
  throw new Error(
    "Missing IndexNow key. Set INDEXNOW_KEY or create public/.well-known/indexnow-key.txt",
  );
}

const key = loadKey();
const keyLocation = `${base}/${key}.txt`;

const body = {
  host,
  key,
  keyLocation,
  urlList: urls,
};

const endpoints = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
];

async function post(endpoint) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { endpoint, status: res.status, body: text.slice(0, 300) };
}

// Prove key is public before submit
const keyCheck = await fetch(keyLocation);
if (!keyCheck.ok) {
  console.error(
    `Key file not live: ${keyLocation} → HTTP ${keyCheck.status}. Deploy first.`,
  );
  process.exit(1);
}
const keyBody = (await keyCheck.text()).trim();
if (keyBody !== key) {
  console.error(`Key file mismatch at ${keyLocation}`);
  process.exit(1);
}
console.log(`Key live: ${keyLocation}`);
console.log(`Submitting ${urls.length} URLs…`);

const results = [];
for (const endpoint of endpoints) {
  try {
    results.push(await post(endpoint));
  } catch (err) {
    results.push({
      endpoint,
      status: "ERR",
      body: String(err?.message || err),
    });
  }
}

for (const r of results) {
  console.log(`${r.status}\t${r.endpoint}\t${r.body || "(empty)"}`);
}

// 200 / 202 = accepted. 422 often = key or URL problem.
const ok = results.some((r) => r.status === 200 || r.status === 202);
process.exit(ok ? 0 : 2);
