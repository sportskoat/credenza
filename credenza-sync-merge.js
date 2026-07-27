// ═══════════════════════════════════════════════════════════════════════════════
// credenza-sync-merge.js — reconciling two copies of one shelf (LB-7)
//
// Pure. No fetch, no DOM, no clock of its own — every function takes `now`.
// preview/src/sync.js does the network; this file decides what the shelf holds
// afterwards, and it is the part that can silently destroy a user's data.
//
// THE PROBLEM WITH A UNION
//
// Whole-document sync means each device holds an array and the server holds an
// array. The obvious merge is a union by item id. It is wrong, and it fails in
// the one direction a user notices:
//
//   Device A and B both hold cards 1, 2, 3. On A the user deletes card 2 and
//   pushes [1, 3]. B pulls. A union of [1, 3] and B's [1, 2, 3] is [1, 2, 3].
//   Card 2 comes back. B pushes it. Now it is back on A too.
//
// A deletion that will not stay deleted is worse than no sync at all, because
// the user cannot fix it by deleting again. So a delete has to leave something
// behind that says "this id is gone, as of this time": a tombstone.
//
// THE OPPOSITE FAILURE
//
// The other direction is worse still. If the absence of an id counted as a
// delete, then a brand-new device — signed in, empty shelf, no tombstones —
// would push an empty array and erase the account. So absence NEVER means
// delete here. Only an explicit tombstone deletes, and only when it is newer
// than the copy of the item it is deleting.
//
// WHAT WINS
//
// Per item, by `updatedAt`, higher wins. Not per document. Editing card 1 on
// the phone and card 2 on the laptop must keep both edits; a document-level
// last-write-wins would throw one away, and that is the second most common way
// a user loses work.
// ═══════════════════════════════════════════════════════════════════════════════

/** How long a tombstone is kept before it is swept. */
export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/**
 * The remote document version. Bump only for a shape change that an older
 * client cannot read; the merge below refuses a document from the future
 * rather than guessing at it.
 */
export const SHELF_DOC_VERSION = 1;

const ms = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * The timestamp that decides who wins for one item. `updatedAt` is written on
 * every edit (credenza-fashion.jsx applyUpdate); `createdAt` covers an item
 * that has never been edited. A zero means "oldest possible", so a card with
 * neither loses to anything that has one — which is the safe direction, since
 * the other side then supplies the fields.
 */
export function itemStamp(item) {
  if (!item) return 0;
  return Math.max(ms(item.updatedAt), ms(item.createdAt));
}

/**
 * Record a deletion. Returns a NEW map — the caller owns its own copy.
 * @param {Record<string, number>} tombstones
 * @param {string|string[]} ids
 * @param {number} now
 * @returns {Record<string, number>}
 */
export function addTombstones(tombstones, ids, now) {
  const next = { ...(tombstones || {}) };
  for (const id of Array.isArray(ids) ? ids : [ids]) {
    if (!id) continue;
    // Keep the LATER stamp. A re-delete after a restore must outrank the
    // restore, or the restored card disappears again on the next merge.
    next[String(id)] = Math.max(ms(next[String(id)]), ms(now));
  }
  return next;
}

/**
 * Drop a tombstone, because the id is on the shelf again. Undo calls this.
 * Without it, Undo would put the card back and the next merge would delete it.
 * @param {Record<string, number>} tombstones
 * @param {string|string[]} ids
 * @returns {Record<string, number>}
 */
export function clearTombstones(tombstones, ids) {
  const next = { ...(tombstones || {}) };
  for (const id of Array.isArray(ids) ? ids : [ids]) delete next[String(id)];
  return next;
}

/**
 * Forget tombstones older than the TTL. A tombstone is only needed until every
 * device has seen it; keeping them forever grows the document without bound.
 * The risk of sweeping too early is that a device offline for longer than the
 * TTL resurrects a card — 90 days makes that unlikely, and a resurrected card
 * is recoverable where a lost one is not.
 * @param {Record<string, number>} tombstones
 * @param {number} now
 * @param {number} [ttl]
 * @returns {Record<string, number>}
 */
export function sweepTombstones(tombstones, now, ttl = TOMBSTONE_TTL_MS) {
  const next = {};
  for (const [id, at] of Object.entries(tombstones || {})) {
    if (ms(now) - ms(at) < ttl) next[id] = ms(at);
  }
  return next;
}

/**
 * Merge one item id that exists on both sides. Exported for the tests, because
 * this single comparison is where a lost edit comes from.
 *
 * Field-level merge is deliberately NOT done. A half-merged card — this
 * device's title with that device's price — is a state neither user ever saw
 * and cannot reason about. The whole card wins or loses together.
 */
export function pickItem(a, b) {
  if (!a) return b;
  if (!b) return a;
  const sa = itemStamp(a);
  const sb = itemStamp(b);
  if (sa !== sb) return sa > sb ? a : b;
  // Same millisecond, different content. Any rule works as long as BOTH
  // devices pick the same one, or they push conflicting documents forever.
  // So the tiebreak must depend only on the two cards, NOT on which one was
  // passed first, and NOT on the id — at this point the ids are equal, that
  // is why both cards are here.
  //
  // Prefer the card carrying more, then compare the serialized content.
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja.length !== jb.length) return ja.length > jb.length ? a : b;
  if (ja === jb) return a; // identical; either answer is the same answer
  return ja < jb ? a : b;
}

/**
 * Reconcile a local shelf with a remote one.
 *
 * @param {{ items: object[], tombstones?: Record<string, number> }} local
 * @param {{ items: object[], tombstones?: Record<string, number> }} remote
 * @param {{ now?: number, ttl?: number }} [options]
 * @returns {{ items: object[], tombstones: Record<string, number>, changedLocal: boolean, changedRemote: boolean, stats: object }}
 */
export function mergeShelves(local, remote, options = {}) {
  const now = ms(options.now) || 0;
  const localItems = Array.isArray(local && local.items) ? local.items : [];
  const remoteItems = Array.isArray(remote && remote.items) ? remote.items : [];

  const tombstones = sweepTombstones(
    { ...(remote && remote.tombstones), ...(local && local.tombstones) },
    now,
    options.ttl
  );
  // The spread above takes the LOCAL stamp on a collision, which is not
  // necessarily the later one. Fix that rather than trusting spread order.
  for (const [id, at] of Object.entries((remote && remote.tombstones) || {})) {
    if (tombstones[id] != null) tombstones[id] = Math.max(tombstones[id], ms(at));
  }

  const byId = new Map();
  const order = [];
  const take = (item) => {
    if (!item || !item.id) return;
    const id = String(item.id);
    if (!byId.has(id)) order.push(id);
    byId.set(id, pickItem(byId.get(id), item));
  };
  // Local order first: the shelf a person is looking at should not reshuffle
  // under them because a sync landed.
  for (const item of localItems) take(item);
  for (const item of remoteItems) take(item);

  let deleted = 0;
  const merged = [];
  for (const id of order) {
    const item = byId.get(id);
    const killed = tombstones[id];
    // A tombstone only wins against a copy that is OLDER than it. An edit made
    // after the delete is a resurrection on purpose — the user typed into that
    // card — and it must survive.
    if (killed != null && itemStamp(item) <= killed) {
      deleted++;
      continue;
    }
    if (killed != null) delete tombstones[id];
    merged.push(item);
  }

  const localKey = JSON.stringify(localItems.map((x) => x && x.id));
  const remoteKey = JSON.stringify(remoteItems.map((x) => x && x.id));
  const mergedKey = JSON.stringify(merged.map((x) => x.id));

  // LB-60. How many cards this device did NOT already have. The caller shows
  // "N cards restored from your account" off this number, so it must count
  // arrivals and nothing else:
  //
  //   NOT merged.length - localItems.length. A sync that restores 3 cards and
  //   drops 2 to tombstones nets 1, and the person sees "1 card restored"
  //   after watching three appear.
  //   NOT remoteItems.length. The overlap is the normal case — the same shelf
  //   on two devices would report every card as restored, every sign-in.
  //
  // A local id counts as present even if a tombstone later removed the card,
  // because the device had it either way and nothing arrived for it.
  const localIds = new Set(localItems.filter((x) => x && x.id).map((x) => String(x.id)));
  const added = merged.filter((x) => !localIds.has(String(x.id))).length;

  return {
    items: merged,
    tombstones,
    // Cheap identity checks: a full deep compare on every sync is wasteful,
    // and the caller only needs to know whether a write is worth doing.
    changedLocal: mergedKey !== localKey || JSON.stringify(merged) !== JSON.stringify(localItems),
    changedRemote: mergedKey !== remoteKey || JSON.stringify(merged) !== JSON.stringify(remoteItems),
    stats: {
      local: localItems.length,
      remote: remoteItems.length,
      merged: merged.length,
      added,
      deleted,
      tombstones: Object.keys(tombstones).length,
    },
  };
}

/**
 * Build the document to send. Kept beside the merge so the shape has one
 * definition on the write side and one on the read side.
 */
export function toShelfDoc(items, tombstones, now) {
  return {
    v: SHELF_DOC_VERSION,
    updatedAt: ms(now),
    items: Array.isArray(items) ? items : [],
    tombstones: tombstones || {},
  };
}

/**
 * Read a document that came back from the server. Returns null for anything
 * we cannot trust, and null means "keep local, write nothing" — never "the
 * shelf is empty".
 *
 * This is the guard against the single worst outcome in the whole feature: a
 * truncated response, a proxy's HTML error page, or a future document version
 * being read as an empty shelf and then pushed back over good data.
 */
export function parseShelfDoc(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) return null;
  const v = Number(raw.v);
  // A document from a NEWER client may hold fields this build would drop on
  // the next push. Refusing to merge is data loss avoided, not a failure.
  if (!Number.isFinite(v) || v > SHELF_DOC_VERSION) return null;
  if (!Array.isArray(raw.items)) return null;
  const tombstones = {};
  if (raw.tombstones && typeof raw.tombstones === "object" && !Array.isArray(raw.tombstones)) {
    for (const [id, at] of Object.entries(raw.tombstones)) {
      if (ms(at) > 0) tombstones[String(id)] = ms(at);
    }
  }
  return {
    v,
    updatedAt: ms(raw.updatedAt),
    items: raw.items.filter((x) => x && typeof x === "object" && x.id),
    tombstones,
  };
}
