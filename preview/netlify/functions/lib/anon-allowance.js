// ═══════════════════════════════════════════════════════════════════════════════
// anon-allowance.js — the free taste a signed-out visitor gets
//
// Kyle 2026-07-30: "3 free links". A visitor who has never signed in may build
// THREE complete cards. A complete card needs the link read (resolve) and the
// size chart read (chart-vision), because a card without a chart is the blank
// card this whole change exists to remove. Ask stays behind sign-in.
//
// WHERE THE COUNT LIVES. In the warm function instance, keyed by client IP and
// UTC day — the same place the per-minute windows live. That is deliberately
// NOT a hard total: Netlify runs several instances, so a determined visitor can
// get more than three. The hard money guard is the site-wide daily ceiling in
// limit.js, which every one of these calls still passes through. This counter
// is here to make the NORMAL case correct and cheap, not to stop an attacker.
//
// The IP is never stored. It is folded into a 32-bit hash first, the same way
// logOutcome hashes its key, so no visitor address sits in memory.
// ═══════════════════════════════════════════════════════════════════════════════

// Per signed-out visitor, per UTC day. Keep these in step with the copy in
// credenza-fashion.jsx ("3 free" is a promise the interface makes).
const ANON_FREE_PER_DAY = {
  resolve: 3,
  chartVision: 3,
  ask: 0,
};

const MAX_KEYS = 5000;

const counts = new Map(); // `${day}|${hash}|${feature}` → n

function utcToday(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function hashKey(value) {
  let hash = 5381;
  const s = String(value || "unknown");
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}

function slotKey(feature, clientKey, now) {
  return utcToday(now) + "|" + hashKey(clientKey) + "|" + feature;
}

// Drop every slot from an earlier day once the map grows. A day boundary makes
// the old keys dead weight; nothing else ever needs removing.
function sweep(now) {
  if (counts.size <= MAX_KEYS) return;
  const today = utcToday(now);
  for (const key of counts.keys()) {
    if (!key.startsWith(today + "|")) counts.delete(key);
  }
}

function freeCap(feature) {
  return ANON_FREE_PER_DAY[feature] || 0;
}

// How many free calls this visitor has left for one feature today.
function freeLeft(feature, clientKey, now = Date.now()) {
  const cap = freeCap(feature);
  if (!cap) return 0;
  return Math.max(0, cap - (counts.get(slotKey(feature, clientKey, now)) || 0));
}

// May this signed-out visitor make one more call?
function allowAnon(feature, clientKey, now = Date.now()) {
  return freeLeft(feature, clientKey, now) > 0;
}

// Count one SUCCESSFUL free call. Failed calls are never counted, so a link
// the server cannot read does not cost the visitor one of their three.
function recordAnon(feature, clientKey, now = Date.now()) {
  const cap = freeCap(feature);
  if (!cap) return;
  sweep(now);
  const key = slotKey(feature, clientKey, now);
  counts.set(key, (counts.get(key) || 0) + 1);
}

function _resetForTest() {
  counts.clear();
}

module.exports = { ANON_FREE_PER_DAY, allowAnon, freeLeft, recordAnon, _resetForTest };
