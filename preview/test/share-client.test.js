// LB-8, the client half: the transport in share-api.js and the wiring in
// credenza-fashion.jsx.
//
// The document builder is tested in share-doc.test.js and the two-module
// agreement in share-parity.test.js. Nothing here re-tests those.
//
// The transport tests run the real functions against a stub fetch. The wiring
// tests read the source, because the behaviour under test is "which call site
// exists" — a share built from the search-narrowed list, or a price that is
// null on the shared page and a number on the shelf, is a source-level
// mistake that a render test would only catch with a live server.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createShare, listShares, deleteShare, copyLink } from "../src/share-api.js";

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const app = read("../../credenza-fashion.jsx");
const sheet = read("../../sheets/ShareSheet.jsx");
const links = read("../../sheets/SharedLinksSheet.jsx");
const yourData = read("../../settings/YourDataSection.jsx");
const api = read("../src/share-api.js");
const css = read("../../credenza-fashion.css");

// A fetch that records the call and answers whatever it was given.
function stubFetch(response) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: response.ok !== false,
      status: response.status || 200,
      json: async () => response.body,
    };
  };
  return { impl, calls };
}

describe("the transport carries the token and nothing else", () => {
  it("sends the access token as a bearer on create", async () => {
    const { impl, calls } = stubFetch({ body: { code: "abc", url: "https://x.test/s/abc" } });
    await createShare("tok-123", { code: "abc", doc: { v: 1, items: [] } }, { fetchImpl: impl });
    expect(calls).toHaveLength(1);
    expect(calls[0].init.headers.authorization).toBe("Bearer tok-123");
    expect(calls[0].init.method).toBe("POST");
  });

  it("sends the three Pro options whatever the plan is", async () => {
    // The server forces them off for a free account rather than refusing the
    // share. Withholding them here would make a stale plan badge cost someone
    // their link.
    const { impl, calls } = stubFetch({ body: { url: "https://x.test/s/abc" } });
    await createShare(
      "tok",
      { code: "abc", doc: {}, unlisted: true, hideFooter: true, expiresAt: 999 },
      { fetchImpl: impl }
    );
    const sent = JSON.parse(calls[0].init.body);
    expect(sent.unlisted).toBe(true);
    expect(sent.hideFooter).toBe(true);
    expect(sent.expiresAt).toBe(999);
  });

  it("coerces the three Pro options, so undefined never reaches the server as null", async () => {
    const { impl, calls } = stubFetch({ body: { url: "https://x.test/s/abc" } });
    await createShare("tok", { code: "abc", doc: {} }, { fetchImpl: impl });
    const sent = JSON.parse(calls[0].init.body);
    expect(sent.unlisted).toBe(false);
    expect(sent.hideFooter).toBe(false);
    expect(sent.expiresAt).toBe(null);
  });

  it("keeps the cap message, which tells a free person what to do next", async () => {
    const { impl } = stubFetch({
      ok: false,
      status: 409,
      body: { error: "Free accounts keep 3 share links. Delete one, or upgrade to Pro." },
    });
    await expect(createShare("tok", { code: "a", doc: {} }, { fetchImpl: impl })).rejects.toThrow(
      "Free accounts keep 3 share links. Delete one, or upgrade to Pro."
    );
  });

  // Kyle 2026-08-02 saw "Server not configured: missing SUPABASE_URL" in the
  // Settings panel. It names our environment to somebody who can act on
  // nothing.
  it("never repeats the server's own words about our setup", async () => {
    const { impl } = stubFetch({
      ok: false,
      status: 500,
      body: { error: "Server not configured: missing SUPABASE_URL" },
    });
    await expect(
      createShare("tok", { code: "a", doc: {} }, { fetchImpl: impl })
    ).rejects.toThrow("Sharing is not answering right now. Try again in a minute.");
  });

  it("keeps the real text on the error, where a developer looks", async () => {
    const { impl } = stubFetch({
      ok: false,
      status: 500,
      body: { error: "Server not configured: missing SUPABASE_URL" },
    });
    const err = await createShare("tok", { code: "a", doc: {} }, { fetchImpl: impl }).catch(
      (e) => e
    );
    expect(err.serverError).toBe("Server not configured: missing SUPABASE_URL");
    expect(err.status).toBe(500);
  });

  it("names an expired sign-in rather than answering Unauthorized", async () => {
    const { impl } = stubFetch({ ok: false, status: 401, body: { error: "Unauthorized" } });
    await expect(listShares("tok", { fetchImpl: impl })).rejects.toThrow(
      "Your sign-in expired. Sign in again first."
    );
  });

  it("throws when the server answers 200 with no link", async () => {
    // A create that reports success and returns nothing would leave the sheet
    // showing an empty link box.
    const { impl } = stubFetch({ body: { code: "abc" } });
    await expect(createShare("tok", { code: "a", doc: {} }, { fetchImpl: impl })).rejects.toThrow(
      "Sharing is not answering right now. Try again in a minute."
    );
  });

  it("answers an empty list rather than undefined when the server sends neither", async () => {
    const { impl } = stubFetch({ body: {} });
    expect(await listShares("tok", { fetchImpl: impl })).toEqual([]);
  });

  it("escapes the code in the delete query", async () => {
    const { impl, calls } = stubFetch({ body: { ok: true } });
    await deleteShare("tok", "a b&c", { fetchImpl: impl });
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].url).toContain("?code=a%20b%26c");
  });
});

describe("a blocked clipboard is not a failed share", () => {
  it("returns false when the browser has no clipboard", async () => {
    expect(await copyLink("https://x.test/s/a", {})).toBe(false);
    expect(await copyLink("https://x.test/s/a", null)).toBe(false);
  });

  it("returns false when the browser refuses, rather than throwing", async () => {
    const host = { clipboard: { writeText: async () => { throw new Error("denied"); } } };
    expect(await copyLink("https://x.test/s/a", host)).toBe(false);
  });

  it("returns true and writes the link when it works", async () => {
    let written = null;
    const host = { clipboard: { writeText: async (v) => { written = v; } } };
    expect(await copyLink("https://x.test/s/a", host)).toBe(true);
    expect(written).toBe("https://x.test/s/a");
  });
});

describe("the app shares the haul, not the view", () => {
  it("builds the share list from items, not from the search-narrowed list", () => {
    // listItems is the searched, sorted, on-screen list. A person who searched
    // "hoodie" inside a haul and then tapped Share meant the haul.
    expect(app).toContain("const shareItemsFor = useCallback(");
    expect(app).toMatch(/const shareItemsFor = useCallback\(\s*\(haulName\) => \{[\s\S]{0,600}?return items\s*\n\s*\.filter\(/);
    expect(app).toMatch(/const shareItemsFor = useCallback\([\s\S]*?\},\s*\n\s*\[items\]\s*\n\s*\);/);
  });

  it("normalizes the price through itemUsdAmount", () => {
    // A CNY card carries `price` and a null priceUsd until enrichment. Without
    // this the shared page prints nothing where the shelf prints a number.
    expect(app).toContain("priceUsd: itemUsdAmount(item),");
  });

  it("shares finished cards only", () => {
    expect(app).toContain('item.status === "ready"');
  });

  it("re-reads the session before every create", () => {
    // A share is a cloud write. An expired token must produce a sentence, not
    // a 401 the sheet has to translate.
    expect(app).toMatch(/const createHaulShare = useCallback\(\s*async \(options\) => \{\s*\n\s*const session = await getValidSession\(\);/);
    expect(app).toContain("Your sign-in expired");
  });

  it("stamps one `now` into both the document and the expiry", () => {
    // Two Date.now() calls would let a 1-day link expire a millisecond early
    // or late relative to its own snapshot. One reading, used twice.
    expect(app).toMatch(/const now = Date\.now\(\);[\s\S]{0,900}?expiresAt: expiryFromDays\(options\.expiryDays, now\)/);
  });

  it("offers Share only on a haul that has cards", () => {
    // STEPS-HANDOFF item 4: Share moved into the title-row ⋯ menu. The gate
    // is the same one the visible button had — no cards, no Share.
    expect(app).toContain("canShare={totalsItems.length > 0}");
  });

  it("opens the sheet on a named haul, and closes it by clearing the name", () => {
    expect(app).toContain("setShareHaulName(openHaulName)");
    expect(app).toContain("onClose={() => setShareHaulName(null)}");
  });

  it("lazy-loads the sheet like every other sheet", () => {
    expect(app).toContain('const ShareSheet = lazy(() => import("./sheets/ShareSheet.jsx"));');
    expect(app).toMatch(/\{shareHaulName && \(\s*\n\s*<Suspense fallback=\{null\}>/);
  });
});

describe("the sheet never sees a token", () => {
  it("does not import the transport or the session", () => {
    expect(sheet).not.toContain("share-api");
    expect(sheet).not.toContain("accessToken");
    expect(sheet).not.toContain("getValidSession");
  });

  it("does the network call through the callback the app passed", () => {
    expect(sheet).toContain("const url = await onCreate({");
  });

  it("gates all three Pro options on isPro before they leave the sheet", () => {
    expect(sheet).toContain("unlisted: isPro && unlisted,");
    expect(sheet).toContain("hideFooter: isPro && hideFooter,");
    expect(sheet).toContain("expiryDays: isPro ? expiryDays : null,");
  });

  it("tells a signed-out person why, instead of offering a button that 401s", () => {
    expect(sheet).toContain("Sign in to share");
    expect(sheet).toMatch(/\{!signedIn \?/);
  });

  it("keeps a locked row visible to a screen reader", () => {
    // `disabled` would hide the row from assistive technology, and the row is
    // the only place the Pro offer is stated.
    expect(sheet).toContain("aria-disabled={!isPro}");
    expect(sheet).not.toMatch(/className="cz-share-row[^"]*"\s*\n\s*disabled=/);
  });
});

describe("the endpoint the client calls is the one the site serves", () => {
  it("names the function path, not an /api/ prefix", () => {
    // There is no /api/ prefix on this site. Every client endpoint is
    // /.netlify/functions/<name>.
    expect(api).toContain('"/.netlify/functions/share"');
    expect(api).not.toContain("/api/");
  });
});

describe("the promise in the fine print is kept", () => {
  // ShareSheet tells people to delete links from Settings → Your data →
  // Shared links. If that block disappears, or is renamed, the sentence
  // becomes a lie.
  it("states the route in the share sheet", () => {
    expect(sheet).toContain("Settings → Your data → Shared links");
  });

  it("gives the Your data section a block with that exact name", () => {
    expect(yourData).toContain("Shared links");
  });

  it("shows the block only to a signed-in account", () => {
    // The links live on the server. A signed-out person has none, and the
    // block would only ever be empty.
    expect(yourData).toContain("const signedIn = accountEnabled && !!accountSession;");
    expect(yourData).toContain("{signedIn && sharedLinks ? (");
  });

  it("routes the block to the shared-links manager", () => {
    expect(yourData).toContain("onList={sharedLinks.onList}");
    expect(yourData).toContain("onDelete={sharedLinks.onDelete}");
    expect(app).toContain("onList: listHaulShares,");
    expect(app).toContain("onDelete: deleteHaulShare,");
  });

  it("builds each link URL against this origin, not a hard-coded host", () => {
    // A preview build must list preview links. shareUrl defaults to the
    // production host, so the origin has to be passed in.
    expect(app).toContain("shareUrl(row.id, origin)");
    expect(app).toContain("window.location.origin");
  });

  it("re-reads the session before listing and before deleting", () => {
    expect(app).toMatch(/const listHaulShares = useCallback\(async \(\) => \{\s*\n\s*const session = await getValidSession\(\);/);
    expect(app).toMatch(/const deleteHaulShare = useCallback\(async \(code\) => \{\s*\n\s*const session = await getValidSession\(\);/);
  });

  it("never lets the links sheet see a token", () => {
    expect(links).not.toContain("share-api");
    expect(links).not.toContain("accessToken");
    expect(links).not.toContain("getValidSession");
  });

  it("makes delete two-tap, like Erase my data", () => {
    expect(links).toContain("Tap to confirm");
    expect(links).toContain("armedCode");
  });

  it("tracks busy per code, so two rows never both look busy", () => {
    expect(links).toContain("const [busyCode, setBusyCode] = useState");
    expect(links).not.toContain("const [busy, setBusy] = useState(false)");
  });

  it("distinguishes a failed load from an empty list", () => {
    // Showing "No shared links yet" after a network error tells somebody
    // their links are gone.
    expect(links).toContain("The list could not be loaded.");
    expect(links).toContain("No shared links yet.");
  });
});

describe("every class the sheets use exists in the stylesheet", () => {
  // The sheets are lazy-loaded, so an unstyled class does not show up until
  // someone opens one. This test opens them at build time instead.
  it.each([
    ["ShareSheet.jsx", sheet],
    ["SharedLinksSheet.jsx", links],
  ])("has a rule for each cz- class name in %s", (_name, src) => {
    const used = new Set();
    for (const m of src.matchAll(/"(cz-[a-z0-9-]+)/g)) used.add(m[1]);
    for (const m of src.matchAll(/\s(cz-[a-z0-9-]+)/g)) used.add(m[1]);
    const missing = [...used].filter((name) => !css.includes("." + name));
    expect(missing).toEqual([]);
  });

  it("styles the Share button in the haul header", () => {
    expect(css).toContain(".cz-haul-share");
  });

  it("uses the taller shared frost treatment for Share Haul on desktop", () => {
    expect(sheet).toContain('maxWidth={560}');
    expect(sheet).toContain('surfaceClassName="cz-share-sheet"');
    const start = css.indexOf('@media (min-width: 768px) {\n  /* Kyle 2026-08-02: give the complete share form');
    expect(start).toBeGreaterThan(-1);
    const desktop = css.slice(start, css.indexOf("\n.cz-share {", start));
    expect(desktop).toMatch(/max-height:\s*calc\(100dvh - 24px\);/);
    expect(desktop).toMatch(/background:\s*var\(--cz-frost-fill\);/);
    expect(desktop).toMatch(/border:\s*1px solid var\(--cz-frost-border\);/);
    expect(desktop).not.toContain("backdrop-filter:");
  });

  it("uses tokens, not literal hex, in the share rules", () => {
    const block = css.slice(css.indexOf(".cz-share {"), css.indexOf(".cz-share-link {"));
    // The one exception is the --cz-heart fallback, which the profile sheet
    // already writes the same way.
    const hexes = (block.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter((h) => h !== "#e11d48");
    expect(hexes).toEqual([]);
  });
});
