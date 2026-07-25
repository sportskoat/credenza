// probe-ref-params.mjs — find each agent's REAL referral query-param name.
//
// The definitive test is not documentation, it is behaviour: load the register
// page with a candidate param and a sentinel code, then read the invite-code
// input. If the sentinel appears in the field, that param name is the right one.
//
// Mulebuy and Oopbuy both show an "Invitation Code" input, so both are testable
// this way. Hoobuy has no /register route (404) — its signup is a modal, so we
// probe the home route with the param and read any invite input in the modal.
//
// Run: node scripts/probe-ref-params.mjs
//
// Artifacts and the persistent Chrome profile land OUTSIDE the repo, under
// ~/.credenza-probe/ (override with CREDENZA_PROBE_DIR).

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROBE_ROOT = process.env.CREDENZA_PROBE_DIR || join(homedir(), ".credenza-probe");
const OUT = join(PROBE_ROOT, "ref-param-probe") + "/";
mkdirSync(OUT, { recursive: true });
const PROFILE = join(PROBE_ROOT, "ref-probe-profile");

const SENTINEL = "ZZTESTCODE99";

// Candidate param names seen across this agent family.
const PARAMS = ["ref", "inviteCode", "invitecode", "invite_code", "invite", "code", "promotionCode", "partnercode", "affiliate"];

const TARGETS = [
  { agent: "mulebuy", base: "https://mulebuy.com/register" },
  { agent: "joyagoo", base: "https://joyagoo.com/register" },
  { agent: "oopbuy", base: "https://oopbuy.com/register" },
  { agent: "hoobuy", base: "https://hoobuy.com/" },
  { agent: "allchinabuy", base: "https://www.allchinabuy.com/en/page/login/?type=register" },
];

// Read every text-ish input's value + label, so we can spot the sentinel.
async function readInputs(page) {
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll("input").forEach((el) => {
      out.push({
        name: el.name || null,
        id: el.id || null,
        placeholder: el.placeholder || null,
        value: el.value || null,
        type: el.type || null,
      });
    });
    return out;
  });
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1360, height: 940 },
  locale: "en-US",
  timezoneId: "America/Phoenix",
  args: ["--disable-blink-features=AutomationControlled"],
});

const rows = [];
for (const t of TARGETS) {
  for (const p of PARAMS) {
    const sep = t.base.includes("?") ? "&" : "?";
    const url = `${t.base}${sep}${p}=${SENTINEL}`;
    const page = await ctx.newPage();
    const row = { agent: t.agent, param: p, url };
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      row.status = resp ? resp.status() : null;
      await page.waitForTimeout(7000);
      row.finalUrl = page.url();
      const inputs = await readInputs(page);
      const hit = inputs.find((i) => i.value && i.value.includes(SENTINEL));
      row.match = !!hit;
      row.matchedField = hit ? [hit.name, hit.id, hit.placeholder].filter(Boolean).join(" / ") : null;
      // Also check localStorage/cookies — some agents stash the ref instead of filling a field.
      const stash = await page.evaluate((s) => {
        const found = [];
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if ((localStorage.getItem(k) || "").includes(s)) found.push("ls:" + k);
          }
        } catch (e) { /* ignore */ }
        if (document.cookie.includes(s)) found.push("cookie");
        return found;
      }, SENTINEL);
      row.stashed = stash;
      row.inviteFields = inputs
        .filter((i) => /invit|refer|promo|code/i.test([i.name, i.id, i.placeholder].join(" ")))
        .map((i) => [i.name, i.id, i.placeholder, `val=${i.value}`].filter(Boolean).join(" / "));
    } catch (e) {
      row.error = String(e).slice(0, 140);
    }
    await page.close();
    rows.push(row);
    const flag = row.match ? "★ MATCH" : row.stashed && row.stashed.length ? "◆ STASHED" : "  -    ";
    console.log(`${t.agent.padEnd(12)} ${p.padEnd(14)} ${flag} http=${row.status ?? "-"} ${row.matchedField || (row.stashed || []).join(",") || ""}`);
    if (row.inviteFields && row.inviteFields.length) console.log(`      fields: ${row.inviteFields.join(" | ")}`);
  }
}

await ctx.close();
writeFileSync(`${OUT}report.json`, JSON.stringify(rows, null, 2));

console.log("\n═══ WINNERS ═══");
for (const t of TARGETS) {
  const wins = rows.filter((r) => r.agent === t.agent && (r.match || (r.stashed || []).length));
  console.log(`${t.agent}: ${wins.length ? wins.map((w) => w.param).join(", ") : "none detected"}`);
}
