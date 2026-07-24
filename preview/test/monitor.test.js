import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ACTIVATION_EVENTS,
  ACTIVATION_KEY,
  ERROR_KEY,
  loadActivation,
  loadClientErrors,
  markActivation,
  monitoredFetch,
  recordClientError,
  summarizeClientErrors,
} from "../../monitor.js";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("client error log (Part 6 task 3)", () => {
  it("records, caps at 100, and summarizes by route and status", async () => {
    const { backend, data } = memoryBackend();
    for (let i = 0; i < 110; i++) {
      await recordClientError(backend, { ts: i, route: i % 2 ? "ask" : "resolve", status: i % 3 ? 429 : "network" });
    }
    const stored = JSON.parse(data[ERROR_KEY]);
    expect(stored).toHaveLength(100);
    expect(stored[0].ts).toBe(10); // oldest trimmed

    const summary = summarizeClientErrors(stored);
    expect(summary.total).toBe(100);
    expect(summary.byRoute.ask).toBe(50);
    expect(summary.byRoute.resolve).toBe(50);
    expect(summary.byStatus["429"] + summary.byStatus.network).toBe(100);
  });

  it("loads empty cleanly and survives corrupt json", async () => {
    expect(await loadClientErrors(memoryBackend().backend)).toEqual([]);
    const corrupt = memoryBackend({ [ERROR_KEY]: "{nope" });
    expect(await loadClientErrors(corrupt.backend)).toEqual([]);
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
    await expect(recordClientError(dead, { ts: 1, route: "ask", status: 500 })).resolves.toBeUndefined();
  });
});

describe("monitoredFetch", () => {
  it("passes ok responses through without recording", async () => {
    const { backend, data } = memoryBackend();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    const res = await monitoredFetch(backend, "ask", "https://fn.test/ask", {});
    expect(res.ok).toBe(true);
    expect(data[ERROR_KEY]).toBeUndefined();
  });

  it("records non-ok responses with the http status and still returns them", async () => {
    const { backend } = memoryBackend();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 429 })));
    const res = await monitoredFetch(backend, "ask", "https://fn.test/ask", {});
    expect(res.status).toBe(429);
    const errors = await loadClientErrors(backend);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ route: "ask", status: 429 });
    // The URL never reaches the log — route name only.
    expect(JSON.stringify(errors)).not.toContain("fn.test");
  });

  it("records network failures and rethrows", async () => {
    const { backend } = memoryBackend();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(monitoredFetch(backend, "resolve", "https://fn.test/resolve", {})).rejects.toThrow("Failed to fetch");
    expect(await loadClientErrors(backend)).toMatchObject([{ route: "resolve", status: "network" }]);
  });

  it("ignores aborts — user navigation is not an error", async () => {
    const { backend } = memoryBackend();
    vi.stubGlobal("fetch", vi.fn(async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }));
    await expect(monitoredFetch(backend, "ask", "https://fn.test/ask", {})).rejects.toThrow("aborted");
    expect(await loadClientErrors(backend)).toEqual([]);
  });
});

describe("activation milestones (Part 6 task 4)", () => {
  it("records the first timestamp only — later marks keep the original", async () => {
    const { backend } = memoryBackend();
    expect(await markActivation(backend, "capture", 1000)).toBe(true);
    expect(await markActivation(backend, "capture", 2000)).toBe(false);
    expect(await markActivation(backend, "buyClick", 3000)).toBe(true);
    expect(await loadActivation(backend)).toEqual({ capture: 1000, buyClick: 3000 });
  });

  it("rejects unknown event names and covers the six plan milestones", async () => {
    const { backend } = memoryBackend();
    expect(await markActivation(backend, "madeUp")).toBe(false);
    expect(await loadActivation(backend)).toEqual({});
    expect(ACTIVATION_EVENTS).toEqual(["capture", "import", "haulNamed", "sizeDecision", "qcDecision", "buyClick"]);
  });

  it("survives corrupt json and dead backends", async () => {
    const corrupt = memoryBackend({ [ACTIVATION_KEY]: "[1,2]" });
    expect(await loadActivation(corrupt.backend)).toEqual({});
    const dead = {
      async get() {
        throw new Error("boom");
      },
      async set() {
        throw new Error("boom");
      },
    };
    await expect(markActivation(dead, "capture")).resolves.toBe(false);
  });
});
