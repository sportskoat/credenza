// LB-7 wiring: the parts of cloud sync that live in credenza-fashion.jsx.
//
// These read the source rather than render the app. The behaviour under test
// is "which call sites exist" — a delete that forgets its gravestone, or a
// push that runs before the pull, is a source-level mistake that a render
// test would only catch with a live Supabase.
//
// The merge itself is tested in sync-merge.test.js and the transport in
// sync-transport.test.js. Nothing here re-tests those.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const app = read("../../credenza-fashion.jsx");
const sync = read("../src/sync.js");
const storage = read("../../credenza-storage.js");
const envExample = read("../.env.example");

describe("the flag", () => {
  // A flag that reads "1" while the example file says "true" is a trap: the
  // deploy looks configured and syncs nothing.
  it("reads exactly the value .env.example documents", () => {
    expect(sync).toContain('VITE_ENABLE_SYNC');
    expect(sync).toContain('=== "true"');
    expect(envExample).toContain("VITE_ENABLE_SYNC=");
    expect(envExample).toContain('reads exactly "true"');
  });

  it("cannot turn on without auth, because there is no user id without it", () => {
    expect(sync).toContain("AUTH_ENABLED &&");
  });
});

describe("every delete leaves a gravestone", () => {
  // Four ways a card leaves the shelf. Each one must be recorded, or the next
  // merge pours the deleted cards back.
  it("records the single-card delete", () => {
    expect(app).toContain(
      'applyUpdate((list) => list.filter((item) => item.id !== id));\n    markDeleted(id);'
    );
  });

  it("records the stash Undo", () => {
    expect(app).toContain(
      'applyUpdate((list) => list.filter((x) => x.id !== id));\n        markDeleted(id);'
    );
  });

  it("records every card when the shelf is cleared", () => {
    expect(app).toMatch(/const ids = backup\.map\(\(x\) => x\.id\);/);
    expect(app).toMatch(/applyUpdate\(\(\) => \[\]\);\s*\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*markDeleted\(ids\);/);
  });

  it("lifts the gravestones again on Undo, both paths", () => {
    // Restoring a card without clearing its tombstone deletes it a second
    // time on the next merge — a delete the user never asked for.
    expect(app).toContain("forgetDeleted(batch.map((record) => record.item.id));");
    expect(app).toContain("forgetDeleted(ids);");
  });
});

describe("the gravestones survive a reload", () => {
  it("has its own storage key, separate from the shelf", () => {
    expect(app).toContain('export const TOMBSTONE_KEY = "credenza-fashion-tombstones-v1";');
    expect(app).toContain("storageBackend.set(TOMBSTONE_KEY, JSON.stringify(tombstones))");
    expect(app).toContain("storageBackend\n        .get(TOMBSTONE_KEY)");
  });

  // Erase my data sweeps a fixed list. A key missing from it survives an
  // erase, which is the one thing an erase must not allow.
  it("is swept by Erase my data", () => {
    expect(storage).toContain('"credenza-fashion-tombstones-v1"');
  });

  it("is swept of expired entries on load, so the map cannot grow forever", () => {
    expect(app).toContain("setTombstones(sweepTombstones(parsed, Date.now()))");
  });
});

describe("pull is free, push is Pro", () => {
  // The restore story must never be paywalled. Losing a phone should not mean
  // losing a shelf because the subscription lapsed.
  it("pulls for any signed-in account, with no plan check", () => {
    const effect = app.slice(
      app.indexOf("if (!signedIn || !canPersist || !preferencesHydrated || syncedOnceRef.current) return;")
    );
    const body = effect.slice(0, effect.indexOf("}, [signedIn, canPersist, preferencesHydrated]);"));
    expect(body).toContain("await pullShelf()");
    expect(body).not.toContain("isProPlan");
  });

  it("gates only the continuous card push on Pro", () => {
    expect(app).toContain("if (!signedIn || !isProPlan || !canPersist || !pullDoneRef.current) return;");
    expect(app).toContain("pusherRef.current?.schedule();");
  });

  it("pushes body and shirt defaults for any signed-in account after the pull", () => {
    expect(app).toContain(
      "if (!signedIn || !canPersist || !pullDoneRef.current) return;"
    );
    expect(app).toContain("bodyProfile, fitPrefs, bodyUpdatedAt, fitPrefsUpdatedAt");
  });

  it("still saves the merge once for a free account", () => {
    expect(app).toContain('if (merged.changedRemote || remote.status === "empty")');
    expect(app).toContain("pusherRef.current?.flush();");
  });
});

describe("the shelf is never clobbered by a bad pull", () => {
  // A pull that fails or returns junk must change nothing. This is the single
  // most destructive thing sync could get wrong.
  it("acts only on a document it could read", () => {
    expect(app).toContain('if (remote.status !== "ok" && remote.status !== "empty")');
    expect(app).toContain("pullDoneRef.current = true");
  });

  it("never pushes before the pull has merged", () => {
    expect(app).toContain("!pullDoneRef.current) return;");
  });

  it("carries body and shirt defaults on the shelf it sends", () => {
    expect(app).toContain("bodyProfile");
    expect(app).toContain("fitPrefs");
    expect(sync).toContain("state.bodyProfile");
    expect(sync).toContain("state.fitPrefs");
  });

  it("flushes when the tab hides, where unload does not fire on a phone", () => {
    expect(app).toContain('document.addEventListener("visibilitychange", flush)');
    expect(app).toContain('document.visibilityState === "hidden"');
  });
});

describe("Erase my data reaches the server copy", () => {
  it("deletes the remote row before sweeping the local session key", () => {
    const erase = app.slice(app.indexOf("const eraseEverything = async () => {"));
    const deleteAt = erase.indexOf("deleteRemoteShelf()");
    const sweepAt = erase.indexOf("eraseAllCredenzaData(window)");
    expect(deleteAt).toBeGreaterThan(-1);
    // The sweep removes the session, so the remote call has to go first —
    // afterwards there is no token left to authorize it.
    expect(deleteAt).toBeLessThan(sweepAt);
  });
});
