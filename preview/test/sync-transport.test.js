// LB-7 transport: pullShelf / pushShelf / deleteRemoteShelf / createShelfPusher.
//
// Every call takes an injected fetchImpl and an injected session, so nothing
// here touches the network and nothing depends on whether preview/.env is
// filled in on this machine.
//
// What these tests are actually protecting: the shelf on this device. A pull
// that returns garbage must not clear it, a 401 must not lose the write, and
// a burst of edits must not turn into a burst of requests.

import { describe, it, expect, vi } from "vitest";
import {
  pullShelf,
  pushShelf,
  deleteRemoteShelf,
  createShelfPusher,
  SHELF_TABLE,
} from "../src/sync.js";
import { SHELF_DOC_VERSION, toShelfDoc } from "../../credenza-sync-merge.js";

const BASE = "https://example.supabase.co";
const T0 = 1_700_000_000_000;

const session = (accessToken = "token-1") => ({
  accessToken,
  refreshToken: "refresh-1",
  expiresAt: T0 + 3600_000,
  user: { id: "user-abc", email: "a@example.com" },
});

const card = (id, at = T0) => ({ id, title: "Card " + id, createdAt: at, updatedAt: at });

// A fetch double that records calls and answers from a queue of responses.
function fakeFetch(responses) {
  const calls = [];
  const queue = Array.isArray(responses) ? [...responses] : [responses];
  const impl = vi.fn(async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    const spec = typeof next === "function" ? next(String(url), init) : next;
    return {
      ok: spec.status >= 200 && spec.status < 300,
      status: spec.status,
      json: async () => {
        if (spec.throws) throw new Error("bad json");
        return spec.body;
      },
    };
  });
  impl.calls = calls;
  return impl;
}

const opts = (fetchImpl, extra = {}) => ({
  fetchImpl,
  baseUrl: BASE,
  anonKey: "anon-key",
  session: session(),
  ...extra,
});

describe("pullShelf", () => {
  it("reads this account's row and nobody else's", async () => {
    const doc = toShelfDoc([card("a")], {}, T0);
    const f = fakeFetch({ status: 200, body: [{ data: doc, updated_at: "2026-07-26T00:00:00Z" }] });
    const out = await pullShelf(opts(f));
    expect(out.status).toBe("ok");
    expect(out.doc.items).toHaveLength(1);
    expect(out.updatedAt).toBe("2026-07-26T00:00:00Z");

    const url = f.calls[0].url;
    expect(url).toContain("/rest/v1/" + SHELF_TABLE);
    expect(url).toContain("user_id=eq.user-abc");
    expect(f.calls[0].init.headers.authorization).toBe("Bearer token-1");
  });

  it("reports an account with no row as empty, not as an error", async () => {
    const f = fakeFetch({ status: 200, body: [] });
    expect((await pullShelf(opts(f))).status).toBe("empty");
  });

  // The important one. A row we cannot read must never be mistaken for a
  // shelf, because the caller merges what comes back — and merging a null
  // shelf against a real one is how an account gets emptied.
  it("refuses a row it cannot parse, and says so distinctly from empty", async () => {
    for (const data of [null, "not json", 42, [], { v: 999, items: [] }, { items: "nope" }]) {
      const f = fakeFetch({ status: 200, body: [{ data, updated_at: null }] });
      const out = await pullShelf(opts(f));
      expect(out.status).toBe("invalid");
      expect(out.doc).toBeUndefined();
    }
  });

  it("treats a network failure as an error and returns no document", async () => {
    const f = vi.fn(async () => {
      throw new Error("offline");
    });
    const out = await pullShelf(opts(f));
    expect(out.status).toBe("error");
    expect(out.doc).toBeUndefined();
  });

  it("returns signed-out on 403 rather than pretending the shelf is empty", async () => {
    const f = fakeFetch({ status: 403, body: {} });
    expect((await pullShelf(opts(f))).status).toBe("signed-out");
  });

  it("does nothing at all without a session", async () => {
    const f = fakeFetch({ status: 200, body: [] });
    const out = await pullShelf({ fetchImpl: f, baseUrl: BASE, session: null });
    expect(out.status).toBe("signed-out");
    expect(f).not.toHaveBeenCalled();
  });
});

describe("pushShelf", () => {
  it("upserts the whole document under this user_id", async () => {
    const f = fakeFetch({ status: 201, body: null });
    const doc = toShelfDoc([card("a"), card("b")], { c: T0 }, T0);
    expect((await pushShelf(doc, opts(f))).status).toBe("ok");

    const { url, init } = f.calls[0];
    expect(url).toContain("on_conflict=user_id");
    expect(init.method).toBe("POST");
    expect(init.headers.prefer).toContain("resolution=merge-duplicates");
    const body = JSON.parse(init.body);
    expect(body.user_id).toBe("user-abc");
    expect(body.data.v).toBe(SHELF_DOC_VERSION);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.tombstones).toEqual({ c: T0 });
  });

  it("refuses to push a non-document instead of writing junk to the row", async () => {
    const f = fakeFetch({ status: 201, body: null });
    for (const bad of [null, undefined, "", 0]) {
      expect((await pushShelf(bad, opts(f))).status).toBe("error");
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("reports a server failure without throwing at the caller", async () => {
    const f = fakeFetch({ status: 500, body: {} });
    const out = await pushShelf(toShelfDoc([], {}, T0), opts(f));
    expect(out.status).toBe("error");
  });
});

describe("a token that expires mid-flight", () => {
  // The access token can pass getValidSession and still be rejected by the
  // time the request lands. One refresh, one retry — and the write survives.
  it("refreshes once and retries the write", async () => {
    let attempt = 0;
    const f = vi.fn(async (url) => {
      if (String(url).includes("/auth/v1/token")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "token-2",
            refresh_token: "refresh-2",
            expires_in: 3600,
            user: { id: "user-abc", email: "a@example.com" },
          }),
        };
      }
      attempt += 1;
      return { ok: attempt > 1, status: attempt === 1 ? 401 : 201, json: async () => null };
    });
    const host = { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
    const out = await pushShelf(toShelfDoc([card("a")], {}, T0), opts(f, { host }));
    expect(out.status).toBe("ok");
    expect(attempt).toBe(2);
  });

  it("gives up after one retry rather than looping on a real sign-out", async () => {
    let attempt = 0;
    const f = vi.fn(async (url) => {
      if (String(url).includes("/auth/v1/token")) {
        throw new Error("refresh token revoked");
      }
      attempt += 1;
      return { ok: false, status: 401, json: async () => null };
    });
    const out = await pushShelf(toShelfDoc([card("a")], {}, T0), opts(f));
    expect(out.status).toBe("signed-out");
    expect(attempt).toBe(1);
  });
});

describe("deleteRemoteShelf", () => {
  it("removes the row for Erase my data", async () => {
    const f = fakeFetch({ status: 204, body: null });
    expect((await deleteRemoteShelf(opts(f))).status).toBe("ok");
    expect(f.calls[0].init.method).toBe("DELETE");
    expect(f.calls[0].url).toContain("user_id=eq.user-abc");
  });

  it("counts an already-missing row as success", async () => {
    const f = fakeFetch({ status: 404, body: null });
    expect((await deleteRemoteShelf(opts(f))).status).toBe("ok");
  });
});

describe("createShelfPusher", () => {
  it("collapses a burst of edits into one write", async () => {
    vi.useFakeTimers();
    const f = fakeFetch({ status: 201, body: null });
    const pusher = createShelfPusher({
      getState: () => ({ items: [card("a")], tombstones: {} }),
      delay: 2000,
      now: T0,
      ...opts(f),
    });
    pusher.schedule();
    pusher.schedule();
    pusher.schedule();
    expect(f).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2100);
    expect(f).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("flush sends immediately and cancels the pending timer", async () => {
    vi.useFakeTimers();
    const f = fakeFetch({ status: 201, body: null });
    const pusher = createShelfPusher({
      getState: () => ({ items: [card("a")], tombstones: {} }),
      delay: 2000,
      now: T0,
      ...opts(f),
    });
    pusher.schedule();
    await pusher.flush();
    expect(f).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(f).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  // A change made while a push is in the air must not be lost. If it were,
  // the server would sit stale for as long as the user keeps typing.
  it("pushes a second time when an edit lands mid-flight", async () => {
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    let sent = 0;
    const f = vi.fn(async () => {
      sent += 1;
      if (sent === 1) await gate;
      return { ok: true, status: 201, json: async () => null };
    });
    const pusher = createShelfPusher({
      getState: () => ({ items: [card("a")], tombstones: {} }),
      delay: 0,
      now: T0,
      ...opts(f),
    });
    const first = pusher.flush();
    await Promise.resolve();
    pusher.flush(); // arrives while the first request is still open
    release();
    await first;
    expect(sent).toBe(2);
  });

  it("reads the shelf at send time, not at setup time", async () => {
    let items = [card("a")];
    const f = fakeFetch({ status: 201, body: null });
    const pusher = createShelfPusher({
      getState: () => ({ items, tombstones: {} }),
      delay: 0,
      now: T0,
      ...opts(f),
    });
    items = [card("a"), card("b")];
    await pusher.flush();
    expect(JSON.parse(f.calls[0].init.body).data.items).toHaveLength(2);
  });
});
