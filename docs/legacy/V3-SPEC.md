# Credenza v3 — Merged Implementation Spec (orchestrator-approved)

Credenza is a personal save-it-later and memory app: a walnut credenza full of cream
index cards. Core loop: **Capture instantly. Enrich eventually. Review beautifully.
Remember why I saved it.**

v3 refactors the v2 single-file React artifact (`credenza-v2.jsx`, same directory) into
a more durable prototype. It stays ONE file, no backend, no auth, no Supabase — but the
code must be organized so a backend / iOS Shortcut / database could be swapped in later.

## File organization (single file, clearly banner-commented sections, in this order)

1. `// ═══ CONSTANTS & THEME ═══` — colors, TYPES, fonts, timing constants (DAY_MS etc.)
2. `// ═══ PARSING & CANONICALIZATION ═══`
3. `// ═══ STORAGE ADAPTER ═══`
4. `// ═══ AI ADAPTER ═══`
5. `// ═══ SCORING UTILITIES ═══`
6. `// ═══ COMPONENTS ═══`
7. `// ═══ MAIN APP ═══`

Keep v2's visual system EXACTLY: walnut/cream/mustard palette, Futura headers, mono
accents, index-card digest deck with the red rule at top 46px, flip cards, colored left
spine on cards, "Everything you meant to come back to.", "Already on the shelf",
"From the back of the shelf", warm dry slightly literary microcopy, compact mobile-first
layout (maxWidth 560). Do not make it generic.

## 1. Data model

```js
// Item shape (fields marked [backend] are where future server columns go)
{
  id: string,               // Date.now().toString(36) + random
  createdAt: number,        // epoch ms (v2: ts)
  updatedAt: number,        // epoch ms, bump on every mutation
  rawText: string,          // exactly what the user typed/pasted, never lost
  url: string|null,
  canonicalKey: string,     // see §2
  type: "video"|"tweet"|"audio"|"article"|"note",
  host: string|null,
  videoId: string|null,     // YouTube only
  title: string,
  summary: string,
  tags: string[],
  status: "raw"|"enriching"|"ready"|"failed",
  note: string,             // card-back note
  extractedIntent: string,  // from card-back extraction
  project: string,
  people: string[],
  useCase: string,
  importance: "low"|"medium"|"high",   // default "medium"
  lastOpenedAt: number|null,
  openCount: number,
  resurfacedCount: number,
  lastResurfacedAt: number|null,
  dismissedAt: number|null, // resurfacing dismissal
  digestCount: number,
  lastDigestAt: number|null,
  error: string|null,       // last enrichment error message
  // [backend] future: userId, syncedAt, deletedAt, embedding
}
```

Provide `createItem(parsed, rawText)` factory and `migrateItem(old)` that upgrades v2
items on load (ts→createdAt, text→rawText, pending→status "ready" — a stale pending item
from v2 becomes "failed" so it gets a Retry; compute canonicalKey; fill defaults for all
new fields; idempotent for already-v3 items). Storage key becomes `credenza-items-v3`;
on first load, if v3 key empty, also try v2 key `credenza-items-v1` and migrate.

## 2. Parsing & canonicalization

Keep `classify(raw)` behavior from v2 (note if no URL; youtube/x/tiktok/vimeo→video or
tweet; spotify/soundcloud/apple music→audio; else article) but return `{type, url, host,
videoId}` consistently.

`canonicalKey(parsed, rawText)` rules:
- YouTube (youtube.com watch/shorts/embed, youtu.be): `youtube:<videoId>`
- X/Twitter (x.com, twitter.com): use the status ID if the path matches
  `/<user>/status/<id>` → `x:<id>`; else `x:<normalized path>`
- TikTok: video id from `/video/<id>` or `/t/<code>` → `tiktok:<id>`; else normalized path
- Spotify: `spotify:<pathType>/<id>` from `/track|episode|show|album|playlist|artist/<id>`;
  else normalized path
- Any other URL: `article:<host+path>` where host is lowercased, `www.` stripped, path
  trailing-slash trimmed, and ALL tracking params removed before comparison
  (strip params matching: utm_*, fbclid, gclid, gclsrc, dclid, msclkid, mc_eid, mc_cid,
  igshid, igsh, si, ref, ref_src, ref_url, s, t, feature, ck_subscriber_id, _hsenc,
  _hsmi, vero_id, twclid, ttclid). Note: for x/youtube keys the params are irrelevant
  anyway since we key on IDs.
- Notes: `note:<first 80 chars of lowercased collapsed-whitespace text>` — used for
  EXACT-match duplicate detection only; do NOT fuzzy-match notes.

On duplicate capture (same canonicalKey exists): do NOT create item; show
"Already on the shelf: "<title>" — opened it below." banner (3.5s) and expand the
original card. Input clears.

## 3. Storage adapter

All persistence behind an adapter so a backend can replace it later:

```js
const storageBackend = {
  async get(key) { ... },   // window.storage if it exists, else localStorage
  async set(key, value) { ... },
};
async function loadItems() // returns migrated item array, [] on any error
async function saveItems(items)
```

Detect `window.storage` per call-site safely (typeof window.storage?.get === "function").
localStorage fallback wrapped in try/catch (iOS Safari private mode throws).

**Race-free updates:** in the app, never `setItems(computedArray)` from stale closures.
Use one helper:

```js
const applyUpdate = (fn) => setItems(prev => { const next = fn(prev); saveItems(next); return next; });
const updateItem = (id, patch) => applyUpdate(items =>
  items.map(x => x.id === id ? { ...x, ...(typeof patch === "function" ? patch(x) : patch), updatedAt: Date.now() } : x));
```

All mutations (enrichment completion, note save, edit, open tracking, dismiss, digest
bookkeeping, delete) go through these. This fixes v2's itemsRef race where two in-flight
enrichments could clobber each other.

## 4. AI adapter

All Claude calls live here; components never call fetch directly.

```js
async function callClaude(prompt, { useSearch = false, maxTokens = 1000 } = {})
```
- Check `res.ok`; on !ok throw with status. Check `data.error` and `data.content` shape.
- Keep model `claude-sonnet-4-6` and the web_search tool exactly as v2 (this runs inside
  a Claude Artifact where that fetch is proxied).

`safeParseJson(text)`: strip code fences, find first `{`/last `}`, JSON.parse in
try/catch, also guard against non-string input; returns null on failure.

Adapter functions:
- `enrichItem(item)` → `{title, summary, tags}` — keep v2's three prompt variants
  verbatim (note / tweet-recall-hook / link lookup), throw on hard failure so caller can
  mark status "failed" with `error`.
- `extractCardBackIntent(item, note)` → `{extractedIntent, project, people, useCase,
  importance}`. Try one Claude call (no search, small maxTokens, strict JSON schema
  prompt). On ANY failure fall back to `heuristicIntent(note)`:
  - importance: "high" if /\b(important|critical|must|need to|deadline|asap|!!)\b/i,
    "low" if /\b(someday|maybe|eventually|idle|casual)\b/i, else "medium"
  - project: text after /\bfor (?:the )?([\w\s-]{2,30}?)(?:project|app|site|talk|post)\b/i
    or after "project:" — else ""
  - people: capitalized-word runs that aren't sentence-initial common words (best effort,
    max 3), plus @handles
  - useCase: first clause matching /\b(to|so I can|when I)\s+([^.,;]{3,60})/i else ""
  - extractedIntent: first sentence of the note, trimmed to ~100 chars
  Never block or lose the note itself: note saves synchronously, extraction patches in
  after.
- `askVault(question, candidates)` → plain-text answer. Candidates only (see §5), fields:
  title, summary, tags, host, note, extractedIntent, project, people, useCase, type, date.
  Prompt keeps v2 voice; instruct to weigh note + intent fields heavily.
- `generateDigestCopy(scoredPicks, gem, weekCount)` → `{intro, reasons: {id: reason},
  gemReason}` — Claude only writes the WORDS; selection already happened via scoring. On
  failure, fall back to note/summary as the reason lines and a stock intro. Digest must
  still render fully without AI.

## 5. Search & ASK

- Visible card filter: keep v2 literal substring search, but haystack now includes
  note, extractedIntent, project, people, useCase.
- ASK candidate selection: tokenize query (lowercase, drop <3-char tokens and stopwords).
  Score each ready item: token hit in note ×4, extractedIntent/project/useCase/people ×3,
  title/tags ×2, summary/host ×1. Take top 25 with score>0. If none score, fall back to
  the 40 most recent items. Send only those to `askVault`.

## 6. Digest (keep cream index-card deck + red rule exactly)

`scoreDigestCandidate(item, now)` (pure function):
+ recency: saved <7d +3, <14d +1
+ has note +3
+ importance high +2 / low −1
+ project or useCase present +1
+ never opened (lastOpenedAt null) +2
− digestCount: −1.5 per prior digest appearance (cap −4)
+ small random tiebreaker (±0.5)
Exclude status!=="ready"? No — include "failed" items (they're still saved) but not
"raw"/"enriching".

`scoreForgottenGem(item, now)`: only items >30d old; base on note (+3), importance high
(+2), never opened (+2), low digestCount, random tiebreaker.

Flow: score all → top 3 picks (prefer, not require, last-7-days items via the recency
term) → best gem if any 30d+ items exist → `generateDigestCopy` for intro/reasons →
slides: week intro card ("THIS WEEK ON THE SHELF", "<n> new things stashed"), up to 3
"WORTH YOUR TIME · n", one "FROM THE BACK OF THE SHELF" gem if available, "THAT'S THE
DECK" done card. After building, bump digestCount/lastDigestAt on featured items via
updateItem. OPEN inside the deck also records the open (see §8).

## 7. Resurfacing

`scoreResurfaceCandidate(item, now)`: eligible only if createdAt >14d ago AND not
dismissed in last 7d (dismissedAt) AND status "ready" or "failed".
+ has note +3, importance high +2, never opened +2, project/useCase/people present +1,
− resurfacedCount ×1.5 (cap −4), + age bonus (+1 if >30d), + random ±0.5.
Pick top scorer on app load; render as v2's "FROM THE BACK OF THE SHELF" block with
highlight. When shown, bump resurfacedCount/lastResurfacedAt (once per show, via
updateItem after load). Dismiss sets dismissedAt=now on the item (persisted) and hides it.

## 8. Inbox vs Shelf (capture/review split)

- Capture NEVER fails and NEVER waits on AI: `capture()` synchronously creates the item
  (status "raw", title = url or first 80 chars of text), persists it, clears input,
  then kicks off enrichment async (status→"enriching"→"ready" or "failed"+error).
- **Inbox** = items with status "raw"|"enriching"|"failed". Render as a light strip
  above the shelf: small eyebrow `INBOX · n` in mustard, compact rows (spine color, tiny
  status text: "filing…" for enriching, "couldn't file — RETRY" for failed with a small
  RETRY button that re-runs enrichment, sets status "enriching"). Failed items keep
  rawText/url visible so nothing is ever lost. When an item reaches "ready" it simply
  appears on the shelf (no ceremony). Don't build a separate page/tab — one scroll, Inbox
  strip only renders when non-empty, keeps UI light.
- **Shelf** = status "ready" items, the existing card list.
- Failed items should also be searchable/visible enough that users trust capture.

## 9. Card backs (keep flip exactly)

- Keep flip animation, "BACK OF THE CARD", textarea, SAVE/FLIP BACK.
- `useEffect(() => setDraft(item.note || ""), [item.note])` to keep draft synced.
- On SAVE: `updateItem(id, {note})` immediately, then fire-and-forget
  `extractCardBackIntent` which patches extractedIntent/project/people/useCase/importance
  (only overwrite importance if user hasn't manually edited it — track a
  `importanceEdited` boolean or just let extraction set it; keep simple: extraction sets
  importance only if current importance is "medium" default).
- Back of card may show tiny mono line of current project/intent if present.

## 10. Edit controls

In the expanded card front, an EDIT button toggles a lightweight inline edit panel:
title (input), summary (textarea 2 rows), tags (comma-separated input), project (input),
importance (three small segmented chips LOW/MED/HIGH). SAVE/CANCEL. Styled with existing
LINE borders, PANEL_LT background, Futura labels — must not look bolted-on.

## 11. Open tracking

Every OPEN link (card front, digest deck, resurfaced card) calls
`recordOpen(id)` → `updateItem(id, x => ({lastOpenedAt: Date.now(), openCount:
(x.openCount||0)+1}))` in onClick (don't preventDefault; let the link open).

## 12. Voice & platform

- Keep SpeechRecognition capture only when supported (`window.SpeechRecognition ||
  window.webkitSpeechRecognition`); otherwise hide mic entirely (keyboard dictation
  covers iOS). Keep PASTE button (clipboard API in try/catch).
- iOS Safari: no reliance on hover; tap targets ≥40px where practical; textarea
  fontSize ≥14 stays (avoids zoom-on-focus... v2 uses 14, keep it).

## 13. Explicit non-goals

No auth, no Supabase, no real backend calls, no browser extension, no iOS Shortcut code,
no routing/tabs, no TypeScript (plain JSX artifact), no external deps beyond React.

## Acceptance scenarios (QA will test against these)

1. Save a plain note → instant raw item → enriched to ready.
2. Save a YouTube link; save it again as youtu.be short link → "Already on the shelf."
3. Save an X URL with ?s=20 tracking param, then without → duplicate caught.
4. Enrichment fetch throws → item stays, status failed, error stored, RETRY shown.
5. RETRY re-enriches successfully.
6. Flip card, save note → note persists, ✎ shows, intent fields populate (heuristics if
   AI down).
7. Literal search matches card-back note text.
8. ASK sends ≤25 candidates, weighs notes.
9. Digest with <3 recent items still renders (uses older items), with 0 AI still renders.
10. Digest includes 30d+ forgotten gem when one exists.
11. Resurfaced item is scored (not random), dismiss persists ≥7d.
12. OPEN updates lastOpenedAt/openCount.
13. Refresh persists everything (v2 data migrates on first load).
14. Two rapid captures in flight don't clobber each other's enrichment results.
