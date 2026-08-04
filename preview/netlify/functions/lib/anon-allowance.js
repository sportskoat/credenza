// ═══════════════════════════════════════════════════════════════════════════════
// anon-allowance.js — the free taste a signed-out visitor gets
//
// A visitor who has never signed in may build five complete cards. A complete
// card needs the link read (resolve) and the
// size chart read (chart-vision), because a card without a chart is the blank
// card this whole change exists to remove. Ask stays behind sign-in.
//
// WHERE THE COUNT LIVES. In the warm function instance, keyed by client IP and
// feature — the same place the per-minute windows live. That is deliberately
// NOT a hard total: Netlify runs several instances, so a determined visitor can
// get more than five. The hard money guard is the site-wide daily ceiling in
// limit.js, which every one of these calls still passes through. This counter
// is here to make the NORMAL case correct and cheap, not to stop an attacker.
//
// The IP is never stored. It is folded into a 32-bit hash first, the same way
// logOutcome hashes its key, so no visitor address sits in memory.
// ═══════════════════════════════════════════════════════════════════════════════

// Per signed-out visitor. Keep these in step with the interface promise.
const ANON_FREE_TOTAL = {
  resolve: 5,
  chartVision: 5,
  ask: 0,
};

const MAX_KEYS = 5000;

const counts = new Map(); // `${hash}|${feature}` → n for this warm instance

function hashKey(value) {
  let hash = 5381;
  const s = String(value || "unknown");
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}

function slotKey(feature, clientKey) {
  return hashKey(clientKey) + "|" + feature;
}

// Bound warm-instance memory. The site-wide cost ceiling remains the hard guard.
function sweep() {
  if (counts.size <= MAX_KEYS) return;
  counts.clear();
}

function freeCap(feature) {
  return ANON_FREE_TOTAL[feature] || 0;
}

// How many free calls this visitor has left for one feature.
function freeLeft(feature, clientKey, _now = Date.now()) {
  const cap = freeCap(feature);
  if (!cap) return 0;
  return Math.max(0, cap - (counts.get(slotKey(feature, clientKey)) || 0));
}

// May this signed-out visitor make one more call?
function allowAnon(feature, clientKey, now = Date.now()) {
  return freeLeft(feature, clientKey, now) > 0;
}

// Count one SUCCESSFUL free call. Failed calls are never counted, so a link
// the server cannot read does not cost the visitor one of their five.
function recordAnon(feature, clientKey, _now = Date.now()) {
  const cap = freeCap(feature);
  if (!cap) return;
  sweep();
  const key = slotKey(feature, clientKey);
  counts.set(key, (counts.get(key) || 0) + 1);
}

function _resetForTest() {
  counts.clear();
}

module.exports = { ANON_FREE_TOTAL, allowAnon, freeLeft, recordAnon, _resetForTest };
