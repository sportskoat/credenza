import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const guard = require("../netlify/functions/lib/guard.js");

const PUBLIC_DNS = async () => [{ address: "93.184.216.34" }];

function streamRes(chunks) {
  let i = 0;
  return {
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined },
        cancel: () => ({ catch: () => {} }),
      }),
    },
  };
}

describe("isPrivateIp", () => {
  it("rejects every private and special-use range", () => {
    for (const ip of [
      "0.1.2.3",
      "10.0.0.5",
      "127.0.0.1",
      "100.64.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "192.0.0.1",
      "198.18.0.1",
      "224.0.0.1",
      "240.0.0.1",
      "::",
      "::1",
      "fe80::1",
      "fd00::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(guard.isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("accepts public addresses and rejects malformed ones", () => {
    expect(guard.isPrivateIp("93.184.216.34")).toBe(false);
    expect(guard.isPrivateIp("8.8.8.8")).toBe(false);
    expect(guard.isPrivateIp("2606:4700:4700::1111")).toBe(false);
    expect(guard.isPrivateIp("not-an-ip")).toBe(true);
  });
});

describe("assertSafeUrl", () => {
  beforeEach(() => guard._setLookupForTest(PUBLIC_DNS));
  afterEach(() => guard._setLookupForTest(null));

  it("rejects local and metadata names", async () => {
    for (const url of [
      "http://localhost/admin",
      "http://foo.local/",
      "http://foo.internal/",
      "http://metadata.google.internal/computeMetadata/v1/",
    ]) {
      await expect(guard.assertSafeUrl(url), url).rejects.toMatchObject({ status: 400 });
    }
  });

  it("rejects private literal IPs and encoded forms of 127.0.0.1", async () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://10.0.0.1/",
      "http://192.168.0.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://2130706433/", // decimal 127.0.0.1
      "http://0x7f000001/", // hex 127.0.0.1
      "http://0177.0.0.1/", // octal 127.0.0.1
      "http://127.1/", // short form
      "http://[::1]/",
      "http://[::ffff:127.0.0.1]/",
    ]) {
      await expect(guard.assertSafeUrl(url), url).rejects.toMatchObject({ status: 400 });
    }
  });

  it("rejects non-http protocols and credentials", async () => {
    await expect(guard.assertSafeUrl("file:///etc/passwd")).rejects.toMatchObject({ status: 400 });
    await expect(guard.assertSafeUrl("ftp://example.com/x")).rejects.toMatchObject({ status: 400 });
    await expect(guard.assertSafeUrl("http://user:pass@example.com/")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rejects a host whose DNS answer is private (rebinding)", async () => {
    guard._setLookupForTest(async () => [{ address: "10.0.0.9" }]);
    await expect(guard.assertSafeUrl("https://evil.example.com/")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("enforces the host allowlist when one is given", async () => {
    const hosts = /(^|\.)yupoo\.com$/;
    await expect(guard.assertSafeUrl("https://photo.yupoo.com/a/b.jpg", { hosts })).resolves.toBeTruthy();
    await expect(guard.assertSafeUrl("https://example.com/a.jpg", { hosts })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("accepts a normal public URL", async () => {
    const u = await guard.assertSafeUrl("https://photo.yupoo.com/seller/x/big.jpg");
    expect(u.hostname).toBe("photo.yupoo.com");
  });
});

describe("safeFetch", () => {
  beforeEach(() => guard._setLookupForTest(PUBLIC_DNS));
  afterEach(() => {
    guard._setLookupForTest(null);
    vi.restoreAllMocks();
  });

  it("follows a redirect only after re-validating the destination", async () => {
    const seen = [];
    global.fetch = vi.fn(async (url) => {
      seen.push(url);
      if (seen.length === 1) {
        return { status: 302, headers: { get: () => "https://photo.yupoo.com/final.jpg" } };
      }
      return { status: 200, ok: true, headers: { get: () => null } };
    });
    const res = await guard.safeFetch("https://x.yupoo.com/start", {
      hosts: /(^|\.)yupoo\.com$/,
    });
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(2);
  });

  it("refuses a redirect that leaves the allowlist", async () => {
    global.fetch = vi.fn(async () => ({
      status: 302,
      headers: { get: () => "http://169.254.169.254/latest/meta-data" },
    }));
    await expect(
      guard.safeFetch("https://x.yupoo.com/start", { hosts: /(^|\.)yupoo\.com$/ })
    ).rejects.toMatchObject({ status: 400 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect chain that never ends", async () => {
    global.fetch = vi.fn(async () => ({
      status: 302,
      headers: { get: () => "https://x.yupoo.com/again" },
    }));
    await expect(
      guard.safeFetch("https://x.yupoo.com/start", { hosts: /(^|\.)yupoo\.com$/, maxRedirects: 2 })
    ).rejects.toMatchObject({ status: 502, msg: "Too many redirects" });
  });
});

describe("readCapped", () => {
  it("reads a streamed body under the cap", async () => {
    const res = streamRes([Buffer.from("hello "), Buffer.from("world")]);
    const buf = await guard.readCapped(res, 100);
    expect(buf.toString("utf8")).toBe("hello world");
  });

  it("throws 413 past the cap without reading the rest", async () => {
    const res = streamRes([Buffer.alloc(10), Buffer.alloc(10), Buffer.alloc(10)]);
    await expect(guard.readCapped(res, 15)).rejects.toMatchObject({ status: 413 });
  });

  it("falls back to arrayBuffer/text mocks with a post-read cap", async () => {
    const small = { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    await expect(guard.readCapped(small, 10)).resolves.toHaveLength(3);
    const big = { text: async () => "x".repeat(100) };
    await expect(guard.readCapped(big, 10)).rejects.toMatchObject({ status: 413 });
  });
});
