// Shared SSRF guards for the Credenza functions. One source of truth —
// preview.js grew these first; the audit (Market-Launch-Review, 2026-07-23)
// found chart-vision fetching ANY user-supplied address without them.
//
// Every outbound fetch that touches a user-influenced URL must go through
// safeFetch: protocol allowlist, credential rejection, local/metadata name
// rejection, DNS resolution with private/special-use address rejection
// (covers decimal/hex/octal IPv4 — Node's URL normalizes them to dotted
// form before we check), and manual redirects where every hop is re-checked.
const { promises: dns } = require("dns");
const net = require("net");

// Tests inject a fake resolver here (createRequire bypasses vi.mock, so
// vi.mock("dns") never reaches this module graph).
let lookupFn = (host) => dns.lookup(host, { all: true });

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::" || low === "::1") return true;
    if (/^(fe8|fe9|fea|feb|fc|fd)/.test(low)) return true; // link-local / ULA
    if (low.startsWith("::ffff:")) return isPrivateIp(low.slice(7)); // v4-mapped
    return false;
  }
  const parts = ip.split(".").map(Number);
  // Malformed (e.g. the "7f00:1" tail of a normalized v4-mapped IPv6 literal)
  // fails closed — treated as private.
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

// Throws { status, msg } on rejection; returns the URL on success.
// opts.hosts: optional RegExp the (normalized, lowercased) hostname must match.
/**
 * @param {string} raw
 * @param {{ hosts?: RegExp }} [opts]
 */
async function assertSafeUrl(raw, opts = {}) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw { status: 400, msg: "Invalid URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw { status: 400, msg: "Only http(s)" };
  if (u.username || u.password) throw { status: 400, msg: "Credentials in URL rejected" };
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  )
    throw { status: 400, msg: "Host rejected" };
  if (opts.hosts && !opts.hosts.test(host)) throw { status: 400, msg: "Host rejected" };
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw { status: 400, msg: "Host rejected" };
    return u;
  }
  let addrs;
  try {
    addrs = await lookupFn(host);
  } catch {
    throw { status: 502, msg: "DNS lookup failed" };
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address)))
    throw { status: 400, msg: "Host rejected" };
  return u;
}

// Fetch with manual, validated redirects and a shared deadline.
/**
 * @param {string} rawUrl
 * @param {{ headers?: Record<string, string>, signal?: AbortSignal, hosts?: RegExp, maxRedirects?: number }} [opts]
 */
async function safeFetch(rawUrl, { headers, signal, hosts, maxRedirects = 4 } = {}) {
  let url = rawUrl;
  for (let i = 0; i <= maxRedirects; i++) {
    const u = await assertSafeUrl(url, { hosts });
    const res = await fetch(u.href, { headers, redirect: "manual", signal });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw { status: 502, msg: "Bad redirect" };
      url = new URL(loc, u.href).href;
      continue;
    }
    return res;
  }
  throw { status: 502, msg: "Too many redirects" };
}

// Read a body up to a cap; throws 413 past it. Streams when the runtime
// provides a reader; falls back to a post-read cap for plain mocks.
async function readCapped(res, cap) {
  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > cap) {
        reader.cancel().catch(() => {});
        throw { status: 413, msg: "Body too large" };
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }
  const buf =
    typeof res.arrayBuffer === "function"
      ? Buffer.from(await res.arrayBuffer())
      : Buffer.from(await res.text(), "utf8");
  if (buf.length > cap) throw { status: 413, msg: "Body too large" };
  return buf;
}

module.exports = {
  isPrivateIp,
  assertSafeUrl,
  safeFetch,
  readCapped,
  _setLookupForTest(fn) {
    lookupFn = fn || ((host) => dns.lookup(host, { all: true }));
  },
};
