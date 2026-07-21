// ═══════════════════════════════════════════════════════════════════════════════
// agents.js — buying-agent registry + affiliate Buy plumbing (Monetization Tier A2)
//
// The money pipe: Buy buttons keep pointing at the CANONICAL marketplace link in
// storage forever; wrapping with an agent deep link (+ referral code) happens only
// at open time, in one place (recordOpen in credenza-fashion.jsx). Referral slots
// are empty until Kyle's affiliate signups land — plumbing works regardless.
//
// Template rules:
//   - Agents with urlTemplate substitute encodeURIComponent(canonicalUrl) for {url}.
//   - Agents with idPathTemplate (CSSBuy) need the marketplace numeric item id
//     extracted from the canonical URL instead.
//   - Anything we can't wrap FAILS OPEN to the canonical URL — never strand a buyer.
//   - Templates are one-line edits; when an agent changes their format, fix it here
//     and flip `verified` once Kyle has opened a real item through it.
//   - NEVER delete an agent users may have stored — set retired: true.
// ═══════════════════════════════════════════════════════════════════════════════

export const AGENTS = [
  {
    id: "superbuy",
    name: "Superbuy",
    urlTemplate: "https://www.superbuy.com/en/page/buy?url={url}",
    supports: ["weidian", "taobao", "tmall", "1688"],
    referralParam: "affcode", // confirm exact param name when Kyle's affiliate account is approved
    envKey: "VITE_CREDENZA_REF_SUPERBUY",
    verified: true, // format confirmed against live superbuy.com links (2026-07-20)
    retired: false,
  },
  {
    id: "sugargoo",
    name: "Sugargoo",
    // Canonical item route, observed live in Sugargoo's own login redirect:
    //   /register?redirect=/products?productLink=<weidian url>  (2026-07-20)
    // Note: item pages require a Sugargoo login — logged-out clicks bounce to
    // /register with a redirect back. That's their wall, not a broken link.
    urlTemplate: "https://www.sugargoo.com/products?productLink={url}",
    supports: ["weidian", "taobao", "tmall", "1688"],
    referralParam: "inviteCode", // confirm when affiliate center access lands
    envKey: "VITE_CREDENZA_REF_SUGARGOO",
    verified: false, // route confirmed via live redirect; flip once an item page renders logged-in
    retired: false,
  },
  {
    id: "cssbuy",
    name: "CSSBuy",
    // CSSBuy wants the marketplace item id in the path, not a wrapped URL:
    //   https://www.cssbuy.com/item-{id}.html
    idPathTemplate: "https://www.cssbuy.com/item-{id}.html",
    supports: ["taobao", "tmall", "1688"], // id extraction only wired for these; weidian fails open
    referralParam: "promotionCode", // observed on live cssbuy links (2026-07-20)
    envKey: "VITE_CREDENZA_REF_CSSBUY",
    verified: true,
    // RETIRED 2026-07-20: CSSBuy refuses purchasing-agent service for USA
    // customers ("Due to USA legal reasons… you can use our forwarding
    // service"). Kyle's call: drop them. Entry stays for stored prefs/data —
    // retired agents fail open to the canonical link and hide from the picker.
    retired: true,
  },
  {
    id: "kakobuy",
    name: "Kakobuy",
    urlTemplate: "https://www.kakobuy.com/item/details?url={url}",
    supports: ["weidian", "taobao", "tmall", "1688"],
    referralParam: "ref",
    envKey: "VITE_CREDENZA_REF_KAKOBUY",
    verified: true, // confirmed against a live Weidian item by Kyle (2026-07-20)
    retired: false,
  },
  {
    id: "raw",
    name: "No agent — open marketplace directly",
    urlTemplate: null,
    supports: ["weidian", "taobao", "tmall", "1688", "yupoo"],
    referralParam: null,
    envKey: null,
    verified: true,
    retired: false,
  },
];

export const DEFAULT_AGENT_ID = "superbuy";

export function getAgent(id) {
  return AGENTS.find((a) => a.id === id) || null;
}

// Agents the picker should show: live ones only. Retired entries stay in AGENTS
// forever so stored prefs mentioning them degrade gracefully instead of breaking.
export function listAgents() {
  return AGENTS.filter((a) => !a.retired);
}

// ————— Marketplace detection ————————————————————————————————————————————————

const MARKETPLACE_HOSTS = [
  ["weidian", /(^|\.)weidian\.com$/i],
  ["taobao", /(^|\.)taobao\.com$/i],
  ["tmall", /(^|\.)tmall\.(com|hk)$/i],
  ["1688", /(^|\.)1688\.com$/i],
  ["yupoo", /(^|\.)yupoo\.com$/i],
];

// Returns "weidian" | "taobao" | "tmall" | "1688" | "yupoo" | null.
export function marketplaceOf(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch (e) {
    return null;
  }
  for (const [name, re] of MARKETPLACE_HOSTS) {
    if (re.test(host)) return name;
  }
  return null;
}

// Numeric item id for id-path agents (CSSBuy). Returns { marketplace, id } | null.
export function extractMarketplaceItemId(url) {
  const marketplace = marketplaceOf(url);
  if (!marketplace) return null;
  let m = null;
  if (marketplace === "taobao" || marketplace === "tmall") {
    m = /[?&]id=(\d+)/.exec(url);
  } else if (marketplace === "weidian") {
    m = /[?&]itemID=(\d+)/i.exec(url);
  } else if (marketplace === "1688") {
    m = /\/offer\/(\d+)\.html/.exec(url) || /[?&]offerId=(\d+)/.exec(url);
  }
  if (!m) return null;
  return { marketplace, id: m[1] };
}

// ————— Referral codes ————————————————————————————————————————————————————————

function envReferralCode(agent) {
  if (!agent.envKey) return null;
  try {
    const v = import.meta.env && import.meta.env[agent.envKey];
    return v && String(v).trim() ? String(v).trim() : null;
  } catch (e) {
    return null;
  }
}

// Per-user overrides (prefs.affiliateCodes) win over build-time env codes.
export function resolveReferralCode(agent, overrides) {
  const mine = overrides && overrides[agent.id];
  if (mine && String(mine).trim()) return String(mine).trim();
  return envReferralCode(agent);
}

// ————— URL building ——————————————————————————————————————————————————————————

// Wrap a canonical marketplace link for an agent. NEVER throws; on any mismatch
// returns the canonical URL untouched with wrapped:false and a machine-readable
// reason so the caller can toast.
export function buildAgentUrl(agentId, canonicalUrl, { referralOverrides } = {}) {
  const fail = (reason) => ({ url: canonicalUrl, agentId: agentId || null, wrapped: false, reason });
  if (!canonicalUrl) return fail("no-url");

  const agent = getAgent(agentId);
  if (!agent || agent.retired) return fail("unknown-agent");
  if (!agent.urlTemplate && !agent.idPathTemplate) return { url: canonicalUrl, agentId: agent.id, wrapped: false, reason: "raw" };

  const marketplace = marketplaceOf(canonicalUrl);
  if (!marketplace) return fail("not-marketplace"); // e.g. Yupoo photos links never wrap
  if (!agent.supports.includes(marketplace)) return fail("unsupported-marketplace");

  const code = resolveReferralCode(agent, referralOverrides);

  if (agent.idPathTemplate) {
    const extracted = extractMarketplaceItemId(canonicalUrl);
    if (!extracted) return fail("no-item-id");
    let url = agent.idPathTemplate.replace("{id}", extracted.id);
    if (code && agent.referralParam) {
      url += (url.includes("?") ? "&" : "?") + agent.referralParam + "=" + encodeURIComponent(code);
    }
    return { url, agentId: agent.id, wrapped: true, marketplace };
  }

  let url = agent.urlTemplate.replace("{url}", encodeURIComponent(canonicalUrl));
  if (code && agent.referralParam) {
    url += (url.includes("?") ? "&" : "?") + agent.referralParam + "=" + encodeURIComponent(code);
  }
  return { url, agentId: agent.id, wrapped: true, marketplace };
}

// ————— Outbound click analytics (local only) ————————————————————————————————
// One append-only log, capped so localStorage never balloons. Powers the counts
// view in the Agent sheet and, later, the "is the money pipe working" answer.

export const OUTBOUND_KEY = "credenza-fashion-outbound-v1";
const OUTBOUND_CAP = 500;

// djb2 — stable, tiny, good enough to count clicks per item without storing ids.
export function hashItemId(id) {
  const s = String(id || "");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function loadOutboundClicks(backend) {
  try {
    const raw = await backend.get(OUTBOUND_KEY);
    const list = JSON.parse(raw || "[]");
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

// entry: { ts, agentId, marketplace, wrapped, item: hashItemId(item.id) }
export async function recordOutboundClick(backend, entry) {
  try {
    const list = await loadOutboundClicks(backend);
    list.push(entry);
    await backend.set(OUTBOUND_KEY, JSON.stringify(list.slice(-OUTBOUND_CAP)));
  } catch (e) {
    // analytics must never break the open path
  }
}

// clicks → { total, wrapped, byAgent: {agentId: n}, byMarketplace: {m: n} }
export function summarizeOutbound(clicks) {
  const summary = { total: 0, wrapped: 0, byAgent: {}, byMarketplace: {} };
  for (const c of clicks || []) {
    if (!c) continue;
    summary.total += 1;
    if (c.wrapped) summary.wrapped += 1;
    const a = c.agentId || "unknown";
    summary.byAgent[a] = (summary.byAgent[a] || 0) + 1;
    if (c.marketplace) summary.byMarketplace[c.marketplace] = (summary.byMarketplace[c.marketplace] || 0) + 1;
  }
  return summary;
}
