import { afterEach, describe, it, expect, vi } from "vitest";
import {
  AGENTS,
  DEFAULT_AGENT_ID,
  OUTBOUND_KEY,
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

  it("joyagoo and allchinabuy wrap with the superbuy-family url route", () => {
    expect(buildAgentUrl("joyagoo", WEIDIAN).url).toBe("https://www.joyagoo.com/en/page/buy?url=" + encodeURIComponent(WEIDIAN));
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
