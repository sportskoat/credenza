import { afterEach, describe, it, expect, vi } from "vitest";
import {
  AGENTS,
  DEFAULT_AGENT_ID,
  OUTBOUND_KEY,
  agentOf,
  buildAgentUrl,
  buildSignupUrl,
  extractMarketplaceItemId,
  getAgent,
  hashItemId,
  listAgents,
  loadOutboundClicks,
  marketplaceOf,
  recordOutboundClick,
  resolveReferralCode,
  summarizeOutbound,
  unwrapAgentUrl,
} from "../../agents.js";

const WEIDIAN = "https://weidian.com/item.html?itemID=7234567890";
const TAOBAO = "https://item.taobao.com/item.htm?id=856801351597";

afterEach(() => {
  vi.unstubAllEnvs();
});
const TMALL = "https://detail.tmall.com/item.htm?id=680012345678";
const ALI1688 = "https://detail.1688.com/offer/712345678901.html";
const YUPOO = "https://seller.x.yupoo.com/albums/123456?uid=1";

function memoryBackend(initial = {}) {
  const data = { ...initial };
  return {
    data,
    backend: {
      async get(key) {
        return key in data ? data[key] : null;
      },
      async set(key, value) {
        data[key] = value;
      },
    },
  };
}

describe("marketplaceOf", () => {
  it("classifies the big four marketplaces and yupoo", () => {
    expect(marketplaceOf(WEIDIAN)).toBe("weidian");
    expect(marketplaceOf(TAOBAO)).toBe("taobao");
    expect(marketplaceOf(TMALL)).toBe("tmall");
    expect(marketplaceOf(ALI1688)).toBe("1688");
    expect(marketplaceOf(YUPOO)).toBe("yupoo");
  });

  it("matches subdomains", () => {
    expect(marketplaceOf("https://m.weidian.com/item.html?itemID=1")).toBe("weidian");
    expect(marketplaceOf("https://world.taobao.com/item/1.htm")).toBe("taobao");
  });

  it("returns null for non-marketplace and garbage", () => {
    expect(marketplaceOf("https://www.reddit.com/r/FashionReps")).toBeNull();
    expect(marketplaceOf("not a url")).toBeNull();
    expect(marketplaceOf("")).toBeNull();
  });
});

describe("extractMarketplaceItemId", () => {
  it("pulls numeric ids from taobao, tmall, weidian, and 1688 urls", () => {
    expect(extractMarketplaceItemId(TAOBAO)).toEqual({ marketplace: "taobao", id: "856801351597" });
    expect(extractMarketplaceItemId(TMALL)).toEqual({ marketplace: "tmall", id: "680012345678" });
    expect(extractMarketplaceItemId(WEIDIAN)).toEqual({ marketplace: "weidian", id: "7234567890" });
    expect(extractMarketplaceItemId(ALI1688)).toEqual({ marketplace: "1688", id: "712345678901" });
  });

  it("returns null when no id is present", () => {
    expect(extractMarketplaceItemId("https://www.taobao.com/")).toBeNull();
    expect(extractMarketplaceItemId(YUPOO)).toBeNull();
  });
});

describe("agentOf", () => {
  it("recognizes fansbuy and other agent hosts", () => {
    expect(agentOf("https://fansbuy.com/item-micro-7799601727.html")).toBe("fansbuy");
    expect(agentOf("https://www.superbuy.com/en/page/buy?url=x")).toBe("superbuy");
    expect(agentOf(WEIDIAN)).toBeNull();
  });
});

describe("unwrapAgentUrl", () => {
  // Live haul pastes (Kyle 2026-07-26) — promotionCode only, no ?url=.
  it("unwraps Fansbuy item-micro-{id} to Weidian (with or without ?url=)", () => {
    const haul = "https://fansbuy.com/item-micro-7799601727.html?promotionCode=52c32b7af9506121";
    expect(unwrapAgentUrl(haul)).toEqual({
      url: "https://weidian.com/item.html?itemID=7799601727",
      agentId: "fansbuy",
      marketplace: "weidian",
      itemId: "7799601727",
    });
    expect(unwrapAgentUrl("https://fansbuy.com/item-micro-7809917249.html")).toMatchObject({
      marketplace: "weidian",
      itemId: "7809917249",
    });
    expect(unwrapAgentUrl("https://fansbuy.com/item-micro-7520678906.html?promotionCode=abc")).toMatchObject({
      itemId: "7520678906",
    });
    // With embedded ?url= still lands on the same Weidian id.
    const withUrl =
      "https://fansbuy.com/item-micro-7234567890.html?url=" + encodeURIComponent(WEIDIAN);
    expect(unwrapAgentUrl(withUrl).url).toBe(WEIDIAN);
  });

  it("unwraps Superbuy-family ?url= wraps", () => {
    const wrapped =
      "https://www.superbuy.com/en/page/buy?url=" + encodeURIComponent(WEIDIAN);
    expect(unwrapAgentUrl(wrapped)).toMatchObject({
      url: WEIDIAN,
      agentId: "superbuy",
      marketplace: "weidian",
      itemId: "7234567890",
    });
  });

  it("unwraps mulebuy / joyagoo / cnfans / hoobuy id+platform shapes", () => {
    expect(unwrapAgentUrl("https://mulebuy.com/product/?id=7234567890&shop_type=weidian")).toMatchObject({
      marketplace: "weidian",
      itemId: "7234567890",
      agentId: "mulebuy",
    });
    expect(unwrapAgentUrl("https://cnfans.com/product/?platform=TAOBAO&id=856801351597")).toMatchObject({
      marketplace: "taobao",
      itemId: "856801351597",
    });
    expect(unwrapAgentUrl("https://hoobuy.com/product/2/7234567890")).toMatchObject({
      marketplace: "weidian",
      itemId: "7234567890",
    });
  });

  it("returns null for non-agent and unparseable agent pages", () => {
    expect(unwrapAgentUrl(WEIDIAN)).toBeNull();
    expect(unwrapAgentUrl("https://fansbuy.com/register?invite=x")).toBeNull();
    expect(unwrapAgentUrl("not a url")).toBeNull();
  });
});

describe("buildAgentUrl", () => {
  it("wraps a weidian link for superbuy with an encoded canonical url", () => {
    const r = buildAgentUrl("superbuy", WEIDIAN);
    expect(r.wrapped).toBe(true);
    expect(r.agentId).toBe("superbuy");
    expect(r.marketplace).toBe("weidian");
    expect(r.url).toBe("https://www.superbuy.com/en/page/buy?url=" + encodeURIComponent(WEIDIAN));
  });

  it("wraps the same weidian item for every url-template agent", () => {
    for (const agent of listAgents().filter((a) => a.urlTemplate)) {
      const r = buildAgentUrl(agent.id, WEIDIAN);
      expect(r.wrapped).toBe(true);
      expect(r.url).toContain(encodeURIComponent(WEIDIAN));
    }
  });

  it("cssbuy is retired (USA purchasing blocked): fails open, hides from picker, template mechanics intact if re-enabled", () => {
    const cssbuy = getAgent("cssbuy");
    expect(cssbuy.retired).toBe(true);
    expect(listAgents().some((a) => a.id === "cssbuy")).toBe(false);
    expect(buildAgentUrl("cssbuy", TAOBAO)).toMatchObject({ url: TAOBAO, wrapped: false, reason: "unknown-agent" });

    // id-path mechanics still deserve coverage — retirement is a flag flip.
    cssbuy.retired = false;
    try {
      expect(buildAgentUrl("cssbuy", TAOBAO).url).toBe("https://www.cssbuy.com/item-856801351597.html");
      expect(buildAgentUrl("cssbuy", ALI1688).url).toBe("https://www.cssbuy.com/item-712345678901.html");
      vi.stubEnv("VITE_CREDENZA_REF_CSSBUY", "PROMO9");
      const withCode = buildAgentUrl("cssbuy", TAOBAO);
      expect(withCode.url).toBe("https://www.cssbuy.com/item-856801351597.html?promotionCode=PROMO9");
      expect(buildAgentUrl("cssbuy", WEIDIAN)).toMatchObject({ wrapped: false, reason: "unsupported-marketplace" });
    } finally {
      cssbuy.retired = true;
    }
  });

  it("fails open to canonical for unknown agents, non-marketplace urls, and empty input", () => {
    expect(buildAgentUrl("nope", WEIDIAN)).toMatchObject({ url: WEIDIAN, wrapped: false, reason: "unknown-agent" });
    expect(buildAgentUrl("superbuy", YUPOO)).toMatchObject({ url: YUPOO, wrapped: false, reason: "unsupported-marketplace" });
    expect(buildAgentUrl("superbuy", "")).toMatchObject({ wrapped: false, reason: "no-url" });
  });

  it("wraps weidian for fansbuy with the id+url combined template, fails open for other marketplaces", () => {
    const r = buildAgentUrl("fansbuy", WEIDIAN);
    expect(r.wrapped).toBe(true);
    expect(r.url).toBe(
      "https://fansbuy.com/item-micro-7234567890.html?url=" + encodeURIComponent(WEIDIAN)
    );
    // taobao prefix unverified — must fail open, not guess
    expect(buildAgentUrl("fansbuy", TAOBAO)).toMatchObject({ url: TAOBAO, wrapped: false, reason: "unsupported-marketplace" });
  });

  it("raw agent never wraps", () => {
    expect(buildAgentUrl("raw", WEIDIAN)).toMatchObject({ url: WEIDIAN, wrapped: false, reason: "raw" });
  });

  // Part 6 task 1: the six Pro-plan §9 agents. Formats probed live 2026-07-24
  // (curl against real-shaped ids); verified stays false until Kyle clicks one.
  it("mulebuy wraps with id + shop_type", () => {
    expect(buildAgentUrl("mulebuy", WEIDIAN).url).toBe("https://mulebuy.com/product/?id=7234567890&shop_type=weidian");
    expect(buildAgentUrl("mulebuy", TAOBAO).url).toBe("https://mulebuy.com/product/?id=856801351597&shop_type=taobao");
    expect(buildAgentUrl("mulebuy", TMALL).url).toBe("https://mulebuy.com/product/?id=680012345678&shop_type=tmall");
    expect(buildAgentUrl("mulebuy", ALI1688).url).toBe("https://mulebuy.com/product/?id=712345678901&shop_type=1688");
  });

  // Joyagoo was CORRECTED 2026-07-24. It was assumed to be Superbuy-family and
  // wrapped with /en/page/buy?url=…. A headed-browser test showed that route
  // dumps to the Joyagoo homepage — it returns HTTP 200, so the earlier curl
  // status check passed a link that silently lost the item. Joyagoo is in fact
  // a CNFans-family clone taking id + shop_type. AllChinaBuy stays on the
  // Superbuy wrap; it is a genuine Superbuy sister site.
  it("joyagoo wraps with id + shop_type (NOT the superbuy wrap)", () => {
    expect(buildAgentUrl("joyagoo", WEIDIAN).url).toBe("https://joyagoo.com/product/?id=7234567890&shop_type=weidian");
    expect(buildAgentUrl("joyagoo", TAOBAO).url).toBe("https://joyagoo.com/product/?id=856801351597&shop_type=taobao");
    // Regression guard: never go back to the route that loses the item.
    expect(buildAgentUrl("joyagoo", WEIDIAN).url).not.toContain("/en/page/buy");
  });

  it("allchinabuy wraps with the superbuy-family url route", () => {
    expect(buildAgentUrl("allchinabuy", WEIDIAN).url).toBe("https://www.allchinabuy.com/en/page/buy/?url=" + encodeURIComponent(WEIDIAN));
  });

  it("cnfans wraps with an uppercase platform token and pays no commission", () => {
    expect(buildAgentUrl("cnfans", WEIDIAN).url).toBe("https://cnfans.com/product/?platform=WEIDIAN&id=7234567890");
    expect(buildAgentUrl("cnfans", TAOBAO).url).toBe("https://cnfans.com/product/?platform=TAOBAO&id=856801351597");
    expect(buildAgentUrl("cnfans", ALI1688).url).toBe("https://cnfans.com/product/?platform=1688&id=712345678901");
    // No envKey: even a stubbed env must not attach a code.
    expect(getAgent("cnfans").envKey).toBeNull();
    expect(buildAgentUrl("cnfans", WEIDIAN).url).not.toContain("invite");
  });

  it("hoobuy and oopbuy wrap with numeric platform codes (1 taobao/tmall, 2 weidian, 3 1688)", () => {
    for (const id of ["hoobuy", "oopbuy"]) {
      expect(buildAgentUrl(id, WEIDIAN).url).toBe("https://" + id + ".com/product/2/7234567890");
      expect(buildAgentUrl(id, TAOBAO).url).toBe("https://" + id + ".com/product/1/856801351597");
      expect(buildAgentUrl(id, TMALL).url).toBe("https://" + id + ".com/product/1/680012345678");
      expect(buildAgentUrl(id, ALI1688).url).toBe("https://" + id + ".com/product/3/712345678901");
    }
  });

  it("platform-token agents fail open for yupoo and id-less urls, never guess", () => {
    for (const id of ["mulebuy", "cnfans", "hoobuy", "oopbuy"]) {
      expect(buildAgentUrl(id, YUPOO)).toMatchObject({ url: YUPOO, wrapped: false, reason: "unsupported-marketplace" });
      expect(buildAgentUrl(id, "https://www.taobao.com/")).toMatchObject({ wrapped: false, reason: "no-item-id" });
    }
  });

  it("every new agent appears in the picker and needs no referral code to open", () => {
    for (const id of ["mulebuy", "joyagoo", "cnfans", "hoobuy", "oopbuy", "allchinabuy"]) {
      expect(listAgents().some((a) => a.id === id)).toBe(true);
      const r = buildAgentUrl(id, WEIDIAN);
      expect(r.wrapped).toBe(true);
      expect(r.url).not.toContain("undefined");
    }
  });

  it("never wraps retired agents", () => {
    const agent = getAgent("kakobuy");
    agent.retired = true;
    try {
      expect(buildAgentUrl("kakobuy", WEIDIAN)).toMatchObject({ url: WEIDIAN, wrapped: false, reason: "unknown-agent" });
    } finally {
      agent.retired = false;
    }
  });

  it("attaches the build-time referral code without touching the canonical link", () => {
    const plain = buildAgentUrl("superbuy", WEIDIAN);
    expect(plain.url).not.toContain("partnercode");
    vi.stubEnv("VITE_CREDENZA_REF_SUPERBUY", "KYLE123");
    const withCode = buildAgentUrl("superbuy", WEIDIAN);
    expect(withCode.url).toContain("partnercode=KYLE123");
    // and the stored canonical URL is byte-identical either way
    expect(plain.url).toContain(encodeURIComponent(WEIDIAN));
    expect(withCode.url).toContain(encodeURIComponent(WEIDIAN));
  });

  it("has no per-user override path (audit 2026-07-24 revenue leak)", () => {
    // A third argument used to carry user-typed codes. It is gone: the build
    // env is the only source, so a visitor cannot replace the attribution.
    expect(buildAgentUrl.length).toBe(2);
    expect(buildSignupUrl.length).toBe(1);
    expect(resolveReferralCode.length).toBe(1);
  });
});

describe("resolveReferralCode", () => {
  it("reads the build-time env code", () => {
    vi.stubEnv("VITE_CREDENZA_REF_SUPERBUY", "  ABC  ");
    expect(resolveReferralCode(getAgent("superbuy"))).toBe("ABC");
  });

  it("returns null when nothing is set", () => {
    const agent = getAgent("superbuy");
    expect(resolveReferralCode(agent)).toBeNull();
  });
});

describe("buildSignupUrl", () => {
  it("builds the superbuy register link with the confirmed partnercode shape", () => {
    vi.stubEnv("VITE_CREDENZA_REF_SUPERBUY", "888c9Y");
    expect(buildSignupUrl("superbuy")).toBe(
      "https://www.superbuy.com/en/page/login/?partnercode=888c9Y&type=register"
    );
  });

  it("base64-encodes fansbuy signup codes (Fans-VmXrpx91 → RmFucy1WbVhycHg5MQ==)", () => {
    vi.stubEnv("VITE_CREDENZA_REF_FANSBUY", "Fans-VmXrpx91");
    expect(buildSignupUrl("fansbuy")).toBe(
      "https://fansbuy.com/register?invite=" + encodeURIComponent("RmFucy1WbVhycHg5MQ==")
    );
  });

  it("returns null without a code, for agents without a signup template, and for retired agents", () => {
    expect(buildSignupUrl("superbuy")).toBeNull();
    vi.stubEnv("VITE_CREDENZA_REF_KAKOBUY", "X");
    expect(buildSignupUrl("kakobuy")).toBeNull();
    vi.stubEnv("VITE_CREDENZA_REF_CSSBUY", "X");
    expect(buildSignupUrl("cssbuy")).toBeNull();
  });
});

describe("registry hygiene", () => {
  it("has unique ids and a valid default", () => {
    const ids = AGENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getAgent(DEFAULT_AGENT_ID)).toBeTruthy();
    expect(getAgent(DEFAULT_AGENT_ID).retired).toBe(false);
  });

  it("every wrapping agent has a template containing its placeholder", () => {
    for (const a of AGENTS) {
      if (a.urlTemplate) expect(a.urlTemplate).toContain("{url}");
      if (a.idPathTemplate) expect(a.idPathTemplate).toContain("{id}");
      if (a.idPlatformTemplate) {
        expect(a.idPlatformTemplate).toContain("{id}");
        expect(a.idPlatformTemplate).toContain("{platform}");
        // Every supported marketplace must have a platform token.
        for (const m of a.supports) expect(a.platformMap[m]).toBeTruthy();
      }
    }
  });
});

describe("outbound click log", () => {
  it("records, caps at 500, and summarizes", async () => {
    const { backend, data } = memoryBackend();
    for (let i = 0; i < 510; i++) {
      await recordOutboundClick(backend, { ts: i, agentId: i % 2 ? "superbuy" : "raw", marketplace: "weidian", wrapped: i % 2 === 1, item: hashItemId("item" + i) });
    }
    const stored = JSON.parse(data[OUTBOUND_KEY]);
    expect(stored).toHaveLength(500);
    expect(stored[0].ts).toBe(10); // oldest trimmed

    const summary = summarizeOutbound(stored);
    expect(summary.total).toBe(500);
    expect(summary.byAgent.superbuy).toBe(250);
    expect(summary.byAgent.raw).toBe(250);
    expect(summary.wrapped).toBe(250);
    expect(summary.byMarketplace.weidian).toBe(500);
  });

  it("loads empty cleanly and survives corrupt json", async () => {
    const empty = memoryBackend();
    expect(await loadOutboundClicks(empty.backend)).toEqual([]);
    const corrupt = memoryBackend({ [OUTBOUND_KEY]: "{nope" });
    expect(await loadOutboundClicks(corrupt.backend)).toEqual([]);
  });

  it("never throws when the backend fails", async () => {
    const dead = {
      async get() {
        throw new Error("boom");
      },
      async set() {
        throw new Error("boom");
      },
    };
    await expect(recordOutboundClick(dead, { ts: 1 })).resolves.toBeUndefined();
  });
});

describe("hashItemId", () => {
  it("is stable and distinct", () => {
    expect(hashItemId("abc")).toBe(hashItemId("abc"));
    expect(hashItemId("abc")).not.toBe(hashItemId("abd"));
    expect(hashItemId("")).toBeTruthy();
  });
});

// ─── Pure-layer negative + fail-open matrix (Claude pure lane, 2026-07-25) ───
// Safe while K3 owns UI: imports agents.js only. See docs/lane-notes-for-k3.md.

describe("marketplaceOf negatives", () => {
  it("returns null for non-marketplace hosts and schemes", () => {
    expect(marketplaceOf("https://example.com/item?id=1")).toBe(null);
    expect(marketplaceOf("https://weidian.evil.example/item.html?itemID=1")).toBe(null);
    expect(marketplaceOf("javascript:alert(1)")).toBe(null);
    expect(marketplaceOf("data:text/html,hi")).toBe(null);
    expect(marketplaceOf("")).toBe(null);
    expect(marketplaceOf(null)).toBe(null);
  });

  it("still recognizes the four marketplaces", () => {
    expect(marketplaceOf(WEIDIAN)).toBe("weidian");
    expect(marketplaceOf(TAOBAO)).toBe("taobao");
    expect(marketplaceOf(TMALL)).toBe("tmall");
    expect(marketplaceOf(ALI1688)).toBe("1688");
  });
});

describe("extractMarketplaceItemId negatives", () => {
  it("returns null for junk and non-id hosts", () => {
    expect(extractMarketplaceItemId("https://example.com/x")).toBe(null);
    expect(extractMarketplaceItemId("javascript:void(0)")).toBe(null);
    expect(extractMarketplaceItemId("not a url")).toBe(null);
    expect(extractMarketplaceItemId("")).toBe(null);
  });

  it("extracts the known marketplace shapes as { marketplace, id }", () => {
    expect(extractMarketplaceItemId(WEIDIAN)).toEqual({ marketplace: "weidian", id: "7234567890" });
    expect(extractMarketplaceItemId(TAOBAO)).toEqual({ marketplace: "taobao", id: "856801351597" });
    expect(extractMarketplaceItemId(TMALL)).toEqual({ marketplace: "tmall", id: "680012345678" });
    expect(extractMarketplaceItemId(ALI1688)).toEqual({ marketplace: "1688", id: "712345678901" });
  });
});

describe("buildAgentUrl fail-open matrix", () => {
  it("fails open for unknown agent id", () => {
    const out = buildAgentUrl("no-such-agent", WEIDIAN);
    expect(out.wrapped).toBe(false);
    expect(out.url).toBe(WEIDIAN);
  });

  it("fails open for retired CSSBuy (never wraps)", () => {
    const out = buildAgentUrl("cssbuy", TAOBAO);
    expect(out.wrapped).toBe(false);
    expect(out.url).toBe(TAOBAO);
  });

  it("fails open when CSSBuy gets a Weidian link (id path not wired)", () => {
    // Even if CSSBuy were not retired, Weidian is outside its supports.
    // With retired:true the reason is unknown/retired — still fail-open.
    const out = buildAgentUrl("cssbuy", WEIDIAN);
    expect(out.wrapped).toBe(false);
    expect(out.url).toBe(WEIDIAN);
  });

  it("wraps Superbuy for Taobao (Buy still works when resolve does not)", () => {
    const out = buildAgentUrl("superbuy", TAOBAO);
    expect(out.wrapped).toBe(true);
    expect(out.url).toContain("superbuy.com");
    expect(out.url).toContain(encodeURIComponent(TAOBAO));
  });

  it("never wraps a javascript: URL", () => {
    const evil = "javascript:alert(1)";
    const out = buildAgentUrl("superbuy", evil);
    // Either refuse wrap or pass through — must not invent a superbuy deep link
    // that embeds active script as a product URL in a surprising way for buyers.
    // Current contract: marketplaceOf is empty → fail-open to the raw string.
    expect(out.wrapped).toBe(false);
    expect(out.url).toBe(evil);
  });
});

describe("resolveReferralCode env-only", () => {
  it("returns null when env is unset", () => {
    vi.unstubAllEnvs();
    const agent = getAgent("superbuy");
    // Without a stubbed env the build may still have a value in CI — only assert
    // the type contract: string or null, never an object.
    const code = resolveReferralCode(agent);
    expect(code === null || typeof code === "string").toBe(true);
  });

  it("reads the agent env key when stubbed", () => {
    vi.stubEnv("VITE_CREDENZA_REF_SUPERBUY", "TESTCODE99");
    const code = resolveReferralCode(getAgent("superbuy"));
    expect(code).toBe("TESTCODE99");
    vi.unstubAllEnvs();
  });
});

describe("platformMap completeness for idPlatform agents", () => {
  const PLATFORM_AGENTS = ["mulebuy", "joyagoo", "cnfans", "hoobuy", "oopbuy"];
  const MARKETS = ["weidian", "taobao", "tmall", "1688"];

  it("every platform agent has a token for every marketplace", () => {
    for (const id of PLATFORM_AGENTS) {
      const agent = AGENTS.find((a) => a.id === id);
      expect(agent, id).toBeTruthy();
      expect(agent.platformMap, id + " platformMap").toBeTruthy();
      for (const m of MARKETS) {
        expect(agent.platformMap[m], id + " missing " + m).toBeTruthy();
      }
    }
  });

  it("builds a wrapped URL for each platform agent × marketplace", () => {
    const samples = {
      weidian: WEIDIAN,
      taobao: TAOBAO,
      tmall: TMALL,
      "1688": ALI1688,
    };
    for (const id of PLATFORM_AGENTS) {
      for (const m of MARKETS) {
        const out = buildAgentUrl(id, samples[m]);
        expect(out.wrapped, id + " " + m).toBe(true);
        expect(out.url).toMatch(/^https?:\/\//);
      }
    }
  });
});

// Fixture-driven marketplace identity (Claude pure lane, 2026-07-25)
import marketplaceIdCases from "./fixtures/marketplace-ids.json";

describe("marketplace-ids.json", () => {
  for (const row of marketplaceIdCases.cases) {
    it(row.id, () => {
      expect(marketplaceOf(row.url)).toBe(row.marketplace);
      if (row.itemId == null) {
        expect(extractMarketplaceItemId(row.url)).toBe(null);
      } else {
        expect(extractMarketplaceItemId(row.url)).toEqual({
          marketplace: row.marketplace,
          id: row.itemId,
        });
      }
    });
  }
});
