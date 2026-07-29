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
//   - Agents with idPlatformTemplate (Mulebuy, CNFans, Hoobuy, Oopbuy) need the
//     item id AND the agent's own platform token (platformMap).
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
    // CONFIRMED from Kyle's live affiliate dashboard (2026-07-20): the referral
    // param is partnercode. Signup attribution link shape (trailing slash is
    // Superbuy's canonical normalization, verified by clicking through):
    //   /en/page/login/?partnercode=CODE&type=register
    // partnercode on item buy URLs is unverified — Superbuy likely cookies the
    // attribution on landing; harmless if ignored.
    referralParam: "partnercode",
    signupTemplate: "https://www.superbuy.com/en/page/login/?partnercode={code}&type=register",
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
    // Signup link confirmed 2026-07-28 by following Kyle's affiliate short link:
    // ikako.vip/r/<code> → sl.kakobuy.com/r/<code> → kakobuy.com/register/?affcode=<code>.
    // Item links keep the verified ref param; the register link wants affcode.
    signupTemplate: "https://www.kakobuy.com/register/?affcode={code}",
    envKey: "VITE_CREDENZA_REF_KAKOBUY",
    verified: true, // confirmed against a live Weidian item by Kyle (2026-07-20)
    retired: false,
  },
  {
    id: "fansbuy",
    name: "Fansbuy",
    // CONFIRMED live by Kyle (2026-07-20): Weidian items render as
    //   fansbuy.com/item-micro-<itemID>.html?url=<encoded canonical>
    // "micro" = 微店 (Weidian) — the path prefix is per-marketplace, so only
    // Weidian is supported until the taobao/1688 prefixes are observed live.
    idUrlTemplate: "https://fansbuy.com/item-micro-{id}.html?url={url}",
    supports: ["weidian"],
    // Referral is signup-only: fansbuy.com/register?invite=BASE64(code).
    // Kyle's raw code is Fans-VmXrpx91; store it raw, base64 at link time.
    referralParam: null,
    signupTemplate: "https://fansbuy.com/register?invite={code}",
    signupEncoding: "base64",
    envKey: "VITE_CREDENZA_REF_FANSBUY",
    verified: true,
    retired: false,
  },
  // Part 6 (Pro-plan §9): the six agents the community actually uses, in the
  // plan's add order. Link formats probed live 2026-07-24 (curl status checks
  // against real-shaped item ids); verified flips once Kyle clicks one through.
  // Referral params stay null until Kyle's affiliate approvals land — the env
  // keys are wired so dropping a code in later is a deploy, not a code change.
  {
    id: "mulebuy",
    name: "Mulebuy",
    // Canonical product route (trailing slash is mulebuy's normalization):
    //   mulebuy.com/product/?id=<itemId>&shop_type=<platform>
    idPlatformTemplate: "https://mulebuy.com/product/?id={id}&shop_type={platform}",
    platformMap: { weidian: "weidian", taobao: "taobao", tmall: "tmall", "1688": "1688" },
    supports: ["weidian", "taobao", "tmall", "1688"],
    referralParam: null,
    // Signup-only referral, confirmed from Kyle's affiliate page 2026-07-28:
    //   mulebuy.com/register?ref=<code>   (Kyle's code: 201444039)
    signupTemplate: "https://mulebuy.com/register?ref={code}",
    envKey: "VITE_CREDENZA_REF_MULEBUY",
    verified: false,
    retired: false,
  },
  {
    id: "joyagoo",
    name: "Joyagoo",
    // CORRECTED 2026-07-24 after a headed-browser test against real items.
    // The old guess — the Superbuy-family wrap /en/page/buy?url=… — silently
    // DUMPED TO THE HOMEPAGE. It returned HTTP 200, which is why the earlier
    // curl status check passed it. Joyagoo is a CNFans-family clone, not a
    // Superbuy one; it wants the item id and a platform token:
    //   joyagoo.com/product/?id=<itemId>&shop_type=<platform>
    // Both spellings render (shop_type=weidian and platform=WEIDIAN); we use
    // shop_type, matching Mulebuy. Confirmed rendering a real Weidian item
    // (7800400500) and a real Taobao item (680761597181) — the product page
    // shows the price block and an "Affiliate Share" control.
    idPlatformTemplate: "https://joyagoo.com/product/?id={id}&shop_type={platform}",
    platformMap: { weidian: "weidian", taobao: "taobao", tmall: "tmall", "1688": "1688" },
    supports: ["weidian", "taobao", "tmall", "1688"],
    // Affiliate confirmed from Kyle's JoyaGoo dashboard 2026-07-28: register
    // link joyagoo.com/register?ref=301044677, and the dashboard's link
    // generator redirects to specific pages (product pages) with the affiliate
    // ID — so ?ref= on product links is presumed to attribute. Unconfirmed
    // against a live order; if JoyaGoo ignores it the link still works.
    referralParam: "ref",
    signupTemplate: "https://joyagoo.com/register?ref={code}",
    envKey: "VITE_CREDENZA_REF_JOYAGOO",
    verified: true, // product page rendered live for weidian + taobao (2026-07-24)
    retired: false,
  },
  {
    id: "cnfans",
    name: "CNFans",
    // Largest user base; added for coverage. CNFans stopped paying commission
    // on new referral orders 2026-01-22 (the affiliate-page notice), but Kyle
    // still wants his link in the system (2026-07-28): "change CNFans so my
    // referral link is in our system." Referral is signup-only, like Fansbuy:
    //   cnfans.com/register?ref=<code>   (Kyle's code: 17545386)
    //   cnfans.com/product/?platform=<PLATFORM>&id=<itemId>  (platform is uppercase)
    idPlatformTemplate: "https://cnfans.com/product/?platform={platform}&id={id}",
    platformMap: { weidian: "WEIDIAN", taobao: "TAOBAO", tmall: "TMALL", "1688": "1688" },
    supports: ["weidian", "taobao", "tmall", "1688"],
    referralParam: null,
    signupTemplate: "https://cnfans.com/register?ref={code}",
    envKey: "VITE_CREDENZA_REF_CNFANS",
    verified: false,
    retired: false,
  },
  {
    id: "hoobuy",
    name: "Hoobuy",
    // Numeric platform codes in the path: 1 taobao/tmall, 2 weidian, 3 1688.
    //   hoobuy.com/product/<code>/<itemId>
    idPlatformTemplate: "https://hoobuy.com/product/{platform}/{id}",
    platformMap: { weidian: "2", taobao: "1", tmall: "1", "1688": "3" },
    supports: ["weidian", "taobao", "tmall", "1688"],
    referralParam: null,
    envKey: "VITE_CREDENZA_REF_HOOBUY",
    // Weidian rendered a full product page live (2026-07-24): store name, QC
    // Photos, Purchase Record, weight and volume fields. Taobao redirected to
    // /login?redirect=… — the route is right, Hoobuy just gates taobao behind
    // an account. Logged-in users reach the item; logged-out ones sign up,
    // which is the affiliate conversion point anyway.
    verified: true,
    retired: false,
  },
  {
    id: "oopbuy",
    name: "Oopbuy",
    // Hoobuy-family clone — same numeric platform codes:
    //   oopbuy.com/product/<code>/<itemId>
    idPlatformTemplate: "https://oopbuy.com/product/{platform}/{id}",
    platformMap: { weidian: "2", taobao: "1", tmall: "1", "1688": "3" },
    supports: ["weidian", "taobao", "tmall", "1688"],
    referralParam: null,
    // Signup-only referral, confirmed from Kyle's affiliate page 2026-07-28:
    //   oopbuy.com/register?inviteCode=<code>   (Kyle's code: NCTD1YA8A)
    signupTemplate: "https://oopbuy.com/register?inviteCode={code}",
    envKey: "VITE_CREDENZA_REF_OOPBUY",
    verified: false,
    retired: false,
  },
  {
    id: "allchinabuy",
    name: "AllChinaBuy",
    // Superbuy sister site — same wrap route, canonical trailing slash on buy/:
    //   www.allchinabuy.com/en/page/buy/?url=<encoded canonical>
    urlTemplate: "https://www.allchinabuy.com/en/page/buy/?url={url}",
    supports: ["weidian", "taobao", "tmall", "1688"],
    referralParam: null,
    envKey: "VITE_CREDENZA_REF_ALLCHINABUY",
    verified: false,
    retired: false,
  },
  {
    id: "acbuy",
    name: "ACBuy",
    // Product route probed live 2026-07-28 (headed browser, real Weidian item):
    //   acbuy.com/product/?id=<itemId>&shop_type=<platform>  redirects to
    //   /login?redirectUrl=/product/?id=... — the route EXISTS, it is just
    //   account-gated (same as Hoobuy's taobao). Logged-out visitors sign up,
    //   which is the affiliate conversion point. /product/<n>/<id> and the
    //   Superbuy wrap both DUMP to /home — wrong shapes.
    idPlatformTemplate: "https://www.acbuy.com/product/?id={id}&shop_type={platform}",
    platformMap: { weidian: "weidian", taobao: "taobao", tmall: "tmall", "1688": "1688" },
    supports: ["weidian", "taobao", "tmall", "1688"],
    referralParam: null,
    // Register link from Kyle's affiliate dashboard 2026-07-28:
    //   acbuy.com/login?loginStatus=register&code=<code>   (Kyle: ZCHZ2F; 3.5% → 7.5%)
    signupTemplate: "https://www.acbuy.com/login?loginStatus=register&code={code}",
    envKey: "VITE_CREDENZA_REF_ACBUY",
    verified: false, // account-gated; flip after a logged-in click-through
    retired: false,
  },
  {
    id: "usfans",
    name: "USFans",
    // Product route probed live 2026-07-28 (headed browser, real items):
    //   usfans.com/product/<code>/<itemId> — numeric platform codes, NOT the
    //   Hoobuy set: 3 weidian, 4 1688, 5 taobao (each rendered the real
    //   product page: store, title, weight). Codes 1/2 bounce home; 6 also
    //   renders a taobao item but the page never labels the platform, so
    //   tmall rides 5 until a live tmall item proves otherwise.
    idPlatformTemplate: "https://usfans.com/product/{platform}/{id}",
    platformMap: { weidian: "3", taobao: "5", tmall: "5", "1688": "4" },
    supports: ["weidian", "taobao", "tmall", "1688"],
    referralParam: null,
    // Register link from Kyle's promoter page 2026-07-28:
    //   usfans.com/register?ref=<code>   (Kyle: EQB4RK; 4% → 8%)
    signupTemplate: "https://usfans.com/register?ref={code}",
    envKey: "VITE_CREDENZA_REF_USFANS",
    verified: true, // product pages rendered live for weidian, taobao, 1688 (2026-07-28)
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
  // tb.cn is Taobao's own short-link host (e.tb.cn/h.… share links).
  ["taobao", /(^|\.)(taobao\.com|tb\.cn)$/i],
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

// ————— Agent host recognition (canonical — the ONE list) ————————————————————
// FashionReps posts are full of agent links, including short-link domains
// (Superbuy's youshop10.com). The import parser (reddit-haul.js) and the
// fashion gate (fashion-gate.js) both match against this list — before it
// existed they kept two drifting copies, and agent links fell out of parsing
// entirely (Kyle, 2026-07-24: a pasted QC post became a junk "W2C" card).
// Wider than the AGENTS registry on purpose: people link agents we have no
// URL templates for. Returns the agent token (lowercase) or null.
// fansbuy is outbound-verified + inbound-unwrapped (item-micro-{id} → Weidian).
const AGENT_HOST_RE =
  /(^|\.)(superbuy|youshop10|sugargoo|cssbuy|kakobuy|fansbuy|hoobuy|cnfans|mulebuy|acbuy|oopbuy|basetao|wegobuy|pandabuy|allchinabuy|joyabuy|joyagoo|mycnbox|gtbuy|hipobuy|usfans)\.[a-z.]{2,}$/i;

export function agentOf(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch (e) {
    return null;
  }
  const m = AGENT_HOST_RE.exec(host);
  return m ? m[2].toLowerCase() : null;
}

// Rebuild a clean marketplace product URL from a marketplace token + numeric id.
// Used when an agent link only exposes the id (Fansbuy item-micro, Hoobuy path).
function canonicalMarketplaceUrl(marketplace, itemId) {
  if (!itemId || !/^\d{5,}$/.test(String(itemId))) return null;
  if (marketplace === "weidian") return "https://weidian.com/item.html?itemID=" + itemId;
  if (marketplace === "taobao") return "https://item.taobao.com/item.htm?id=" + itemId;
  if (marketplace === "tmall") return "https://detail.tmall.com/item.htm?id=" + itemId;
  if (marketplace === "1688") return "https://detail.1688.com/offer/" + itemId + ".html";
  return null;
}

// Map agent-specific platform tokens (shop_type / platform / path code) back to
// our marketplace names. Numeric codes match Hoobuy/Oopbuy path layout.
function marketplaceFromAgentPlatform(token) {
  if (token == null || token === "") return null;
  const t = String(token).toLowerCase();
  if (t === "weidian" || t === "2") return "weidian";
  if (t === "taobao" || t === "1") return "taobao";
  if (t === "tmall") return "tmall";
  if (t === "1688" || t === "3") return "1688";
  return null;
}

/**
 * Unwrap a buying-agent product link to a canonical marketplace URL.
 * Storage and resolve always want the marketplace URL, never the agent front.
 * Returns { url, agentId, marketplace, itemId } or null when not unwrapable.
 *
 * Shapes handled (2026-07-26):
 *   - ?url= / ?productLink= / ?link= embedding a marketplace URL (Superbuy family)
 *   - fansbuy.com/item-micro-{id}.html  → weidian (promotionCode optional)
 *   - mulebuy/joyagoo product/?id=&shop_type=
 *   - cnfans product/?platform=&id=
 *   - hoobuy/oopbuy/usfans product/{code}/{id}  (codes are per-agent)
 */
export function unwrapAgentUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  let u;
  try {
    u = new URL(raw.trim());
  } catch (e) {
    return null;
  }
  const agentId = agentOf(u.href);
  if (!agentId) return null;

  // 1) Embedded canonical marketplace URL in a query param.
  for (const key of ["url", "productLink", "product_url", "productUrl", "link"]) {
    const v = u.searchParams.get(key);
    if (!v) continue;
    let decoded = v;
    try {
      decoded = decodeURIComponent(v);
    } catch (e) {
      /* keep raw */
    }
    // Some agents double-encode; try once more when still percent-encoded.
    if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch (e) {
        /* keep */
      }
    }
    const marketplace = marketplaceOf(decoded);
    if (!marketplace || marketplace === "yupoo") continue;
    const extracted = extractMarketplaceItemId(decoded);
    const itemId = extracted ? extracted.id : null;
    const canonical = itemId
      ? canonicalMarketplaceUrl(marketplace, itemId)
      : decoded;
    if (!canonical) continue;
    return { url: canonical, agentId, marketplace, itemId };
  }

  // 2) Fansbuy Weidian micro path (live haul links often omit ?url=).
  //    https://fansbuy.com/item-micro-7799601727.html?promotionCode=…
  if (agentId === "fansbuy") {
    const m = u.pathname.match(/\/item-micro-(\d{5,})(?:\.html)?/i);
    if (m) {
      const itemId = m[1];
      return {
        url: canonicalMarketplaceUrl("weidian", itemId),
        agentId: "fansbuy",
        marketplace: "weidian",
        itemId,
      };
    }
  }

  // 3) id + platform query agents (mulebuy / joyagoo / cnfans-style).
  const idQ = u.searchParams.get("id") || u.searchParams.get("itemId") || u.searchParams.get("item_id");
  const platformQ =
    u.searchParams.get("shop_type") ||
    u.searchParams.get("platform") ||
    u.searchParams.get("shopType");
  if (idQ && /^\d{5,}$/.test(idQ) && platformQ) {
    const marketplace = marketplaceFromAgentPlatform(platformQ);
    const canonical = marketplace && canonicalMarketplaceUrl(marketplace, idQ);
    if (canonical) {
      return { url: canonical, agentId, marketplace, itemId: idQ };
    }
  }

  // 4) Path agents: /product/{platformCode}/{itemId} (hoobuy / oopbuy / usfans).
  //    The numeric codes are PER-AGENT: hoobuy/oopbuy use 2 weidian / 3 1688,
  //    usfans uses 3 weidian / 4 1688 / 5 taobao (probed live 2026-07-28).
  const pathCode = u.pathname.match(/\/product\/([a-z0-9]+)\/(\d{5,})\/?$/i);
  if (pathCode) {
    const USFANS_PATH_PLATFORMS = { 3: "weidian", 4: "1688", 5: "taobao", 6: "tmall" };
    const marketplace =
      agentId === "usfans"
        ? USFANS_PATH_PLATFORMS[pathCode[1]] || null
        : marketplaceFromAgentPlatform(pathCode[1]);
    const itemId = pathCode[2];
    const canonical = marketplace && canonicalMarketplaceUrl(marketplace, itemId);
    if (canonical) {
      return { url: canonical, agentId, marketplace, itemId };
    }
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

// Referral codes come from build-time env ONLY (audit 2026-07-24, the
// revenue leak): the old per-user override let any visitor type a personal
// code into the agent sheet and replace Kyle's attribution. There is no
// override path anymore — codes live in VITE_CREDENZA_REF_* at build time.
export function resolveReferralCode(agent) {
  return envReferralCode(agent);
}

// Signup-attribution link (the actual conversion point for agents whose
// referral pays on registrations, e.g. Superbuy's partnercode register URL).
// Returns null when the agent has no signup template or no code is set.
// signupEncoding: "base64" — some agents (Fansbuy) want the code base64'd.
export function buildSignupUrl(agentId) {
  const agent = getAgent(agentId);
  if (!agent || agent.retired || !agent.signupTemplate) return null;
  const code = resolveReferralCode(agent);
  if (!code) return null;
  let value = code;
  if (agent.signupEncoding === "base64") {
    value = typeof btoa === "function" ? btoa(code) : Buffer.from(code, "utf8").toString("base64");
  }
  return agent.signupTemplate.replace("{code}", encodeURIComponent(value));
}

// ————— URL building ——————————————————————————————————————————————————————————

// Wrap a canonical marketplace link for an agent. NEVER throws; on any mismatch
// returns the canonical URL untouched with wrapped:false and a machine-readable
// reason so the caller can toast.
export function buildAgentUrl(agentId, canonicalUrl) {
  const fail = (reason) => ({ url: canonicalUrl, agentId: agentId || null, wrapped: false, reason });
  if (!canonicalUrl) return fail("no-url");

  const agent = getAgent(agentId);
  if (!agent || agent.retired) return fail("unknown-agent");
  if (!agent.urlTemplate && !agent.idPathTemplate && !agent.idUrlTemplate && !agent.idPlatformTemplate) return { url: canonicalUrl, agentId: agent.id, wrapped: false, reason: "raw" };

  const marketplace = marketplaceOf(canonicalUrl);
  if (!marketplace) return fail("not-marketplace"); // e.g. Yupoo photos links never wrap
  if (!agent.supports.includes(marketplace)) return fail("unsupported-marketplace");

  const code = resolveReferralCode(agent);

  if (agent.idPlatformTemplate) {
    // Platform-token agents (Mulebuy, CNFans, Hoobuy, Oopbuy): the template
    // takes the item id and the agent's own token for the marketplace.
    const token = agent.platformMap && agent.platformMap[marketplace];
    if (!token) return fail("unsupported-marketplace");
    const extracted = extractMarketplaceItemId(canonicalUrl);
    if (!extracted) return fail("no-item-id");
    let url = agent.idPlatformTemplate
      .replace("{id}", extracted.id)
      .replace("{platform}", token);
    if (code && agent.referralParam) {
      url += (url.includes("?") ? "&" : "?") + agent.referralParam + "=" + encodeURIComponent(code);
    }
    return { url, agentId: agent.id, wrapped: true, marketplace };
  }

  if (agent.idPathTemplate || agent.idUrlTemplate) {
    const extracted = extractMarketplaceItemId(canonicalUrl);
    if (!extracted) return fail("no-item-id");
    const template = agent.idPathTemplate || agent.idUrlTemplate;
    let url = template
      .replace("{id}", extracted.id)
      .replace("{url}", encodeURIComponent(canonicalUrl));
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
